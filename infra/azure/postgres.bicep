@description('Azure region for GCC PostgreSQL Flexible Server')
param location string = resourceGroup().location

@description('Short environment token (lowercase alphanumeric, max 5 chars)')
@maxLength(5)
@minLength(3)
param resourceToken string = substring(uniqueString(resourceGroup().id, location), 0, 5)

@description('PostgreSQL administrator login (lowercase)')
param postgresAdminLogin string = 'gccadmin'

@secure()
@description('PostgreSQL administrator password — store in Key Vault / GitHub secret')
param postgresAdminPassword string

@description('PostgreSQL major version')
param postgresVersion string = '16'

@description('Burstable SKU name')
param postgresSkuName string = 'Standard_B1ms'

@description('Storage size GB')
param storageSizeGB int = 32

var serverName = 'azpg${resourceToken}'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: location
  sku: {
    name: postgresSkuName
    tier: 'Burstable'
  }
  properties: {
    version: postgresVersion
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
  }
  tags: {
    product: 'gcc'
    environment: 'production'
    component: 'database'
  }
}

resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource gccDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgresServer
  name: 'gcc'
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

output postgresServerName string = postgresServer.name
output postgresFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = gccDatabase.name
output postgresConnectionHint string = 'postgresql://${postgresAdminLogin}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${gccDatabase.name}?sslmode=require'
