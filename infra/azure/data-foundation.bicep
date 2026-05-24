targetScope = 'resourceGroup'

@description('Short globally distinguishable workload prefix, for example schoolhubprod.')
@minLength(3)
@maxLength(14)
param prefix string

@description('Deployment location. Choose a PostgreSQL region supporting zone redundancy and geo backup.')
param location string = resourceGroup().location

@description('Microsoft Entra tenant ID used by PostgreSQL authentication and Key Vault.')
param tenantId string

@description('Temporary bootstrap PostgreSQL administrator name. Move operational access to Entra after setup.')
param postgresAdministratorLogin string = 'schoolhubbootstrap'

@secure()
@description('Temporary bootstrap database password. Supply securely and rotate after Entra setup.')
param postgresAdministratorPassword string

param tags object = {
  workload: 'school-hub'
  environment: 'production'
  dataClassification: 'confidential'
}

var unique = uniqueString(resourceGroup().id, prefix)
var postgresName = '${prefix}-pg-${unique}'
var vaultName = '${take(prefix, 10)}-kv-${take(unique, 8)}'
var storageName = toLower('${take(replace(prefix, '-', ''), 12)}docs${take(unique, 8)}')

resource applicationIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-app-identity'
  location: location
  tags: tags
}

resource monitoring 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: {
    retentionInDays: 90
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    publicNetworkAccess: 'Disabled'
    sku: {
      family: 'A'
      name: 'premium'
    }
  }
}

resource network 'Microsoft.Network/virtualNetworks@2024-05-01' = {
  name: '${prefix}-vnet'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'postgres'
        properties: {
          addressPrefix: '10.42.1.0/24'
          delegations: [
            {
              name: 'postgres-delegation'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
      {
        name: 'private-endpoints'
        properties: {
          addressPrefix: '10.42.2.0/24'
          privateEndpointNetworkPolicies: 'Disabled'
        }
      }
    ]
  }
}

resource postgresSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: network
  name: 'postgres'
}

resource privateEndpointSubnet 'Microsoft.Network/virtualNetworks/subnets@2024-05-01' existing = {
  parent: network
  name: 'private-endpoints'
}

resource postgresPrivateDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'private.postgres.database.azure.com'
  location: 'global'
  tags: tags
}

resource postgresPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: postgresPrivateDns
  name: '${prefix}-postgres-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: network.id
    }
  }
}

resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: postgresName
  location: location
  tags: tags
  properties: {
    administratorLogin: postgresAdministratorLogin
    administratorLoginPassword: postgresAdministratorPassword
    authConfig: {
      activeDirectoryAuth: 'Enabled'
      passwordAuth: 'Enabled'
      tenantId: tenantId
    }
    backup: {
      backupRetentionDays: 35
      geoRedundantBackup: 'Enabled'
    }
    dataEncryption: {
      type: 'SystemManaged'
    }
    highAvailability: {
      mode: 'ZoneRedundant'
    }
    network: {
      delegatedSubnetResourceId: postgresSubnet.id
      privateDnsZoneArmResourceId: postgresPrivateDns.id
      publicNetworkAccess: 'Disabled'
    }
    storage: {
      autoGrow: 'Enabled'
      storageSizeGB: 128
      tier: 'P10'
      type: 'Premium_LRS'
    }
    version: '16'
  }
  sku: {
    name: 'Standard_D2ds_v5'
    tier: 'GeneralPurpose'
  }
  dependsOn: [
    postgresPrivateDnsLink
  ]
}

resource applicationDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: 'schoolhub'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

resource documents 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageName
  location: location
  tags: tags
  sku: {
    name: 'Standard_GZRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    isHnsEnabled: false
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Disabled'
    supportsHttpsTrafficOnly: true
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: documents
  name: 'default'
  properties: {
    containerDeleteRetentionPolicy: {
      days: 30
      enabled: true
    }
    deleteRetentionPolicy: {
      days: 30
      enabled: true
    }
    isVersioningEnabled: true
  }
}

resource privateDocuments 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: 'student-documents'
  properties: {
    publicAccess: 'None'
  }
}

resource blobPrivateDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.blob.core.windows.net'
  location: 'global'
  tags: tags
}

resource blobPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: blobPrivateDns
  name: '${prefix}-blob-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: network.id
    }
  }
}

resource blobPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: '${prefix}-blob-endpoint'
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [
      {
        name: '${prefix}-blob-connection'
        properties: {
          groupIds: [
            'blob'
          ]
          privateLinkServiceId: documents.id
        }
      }
    ]
    subnet: {
      id: privateEndpointSubnet.id
    }
  }
  dependsOn: [
    blobPrivateDnsLink
  ]
}

resource blobPrivateEndpointDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: blobPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'blob'
        properties: {
          privateDnsZoneId: blobPrivateDns.id
        }
      }
    ]
  }
}

resource keyVaultPrivateDns 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: 'privatelink.vaultcore.azure.net'
  location: 'global'
  tags: tags
}

resource keyVaultPrivateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: keyVaultPrivateDns
  name: '${prefix}-vault-link'
  location: 'global'
  tags: tags
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: network.id
    }
  }
}

resource keyVaultPrivateEndpoint 'Microsoft.Network/privateEndpoints@2024-05-01' = {
  name: '${prefix}-vault-endpoint'
  location: location
  tags: tags
  properties: {
    privateLinkServiceConnections: [
      {
        name: '${prefix}-vault-connection'
        properties: {
          groupIds: [
            'vault'
          ]
          privateLinkServiceId: keyVault.id
        }
      }
    ]
    subnet: {
      id: privateEndpointSubnet.id
    }
  }
  dependsOn: [
    keyVaultPrivateDnsLink
  ]
}

resource keyVaultPrivateEndpointDns 'Microsoft.Network/privateEndpoints/privateDnsZoneGroups@2024-05-01' = {
  parent: keyVaultPrivateEndpoint
  name: 'default'
  properties: {
    privateDnsZoneConfigs: [
      {
        name: 'vault'
        properties: {
          privateDnsZoneId: keyVaultPrivateDns.id
        }
      }
    ]
  }
}

resource documentWriteRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(documents.id, applicationIdentity.id, 'Storage Blob Data Contributor')
  scope: documents
  properties: {
    principalId: applicationIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', 'ba92f5b4-2d11-453d-a403-e96b0029c9fe')
  }
}

resource postgresDiagnostics 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: '${prefix}-postgres-diagnostics'
  scope: postgres
  properties: {
    logs: [
      {
        categoryGroup: 'allLogs'
        enabled: true
      }
    ]
    metrics: [
      {
        category: 'AllMetrics'
        enabled: true
      }
    ]
    workspaceId: monitoring.id
  }
}

output postgresServerName string = postgres.name
output postgresDatabaseName string = applicationDatabase.name
output documentsStorageAccountName string = documents.name
output keyVaultName string = keyVault.name
output applicationManagedIdentityClientId string = applicationIdentity.properties.clientId
output logAnalyticsWorkspaceId string = monitoring.id
