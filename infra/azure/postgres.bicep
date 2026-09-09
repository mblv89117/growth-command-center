@description('Resource-group geography (GCC compute stays here). Not used as the Flexible Server region.')
param location string = resourceGroup().location

@description('PostgreSQL Flexible Server region. eastus is subscription-restricted for this resource type (supportedServerVersions=[]). eastus2 is the evidenced fallback in the same US East geography.')
param postgresLocation string = 'eastus2'

@description('Stable name salt so location fallback does not rename the server')
param nameSalt string = 'gcc-postgres'

@description('Short environment token (lowercase alphanumeric, max 5 chars)')
@maxLength(5)
@minLength(3)
param resourceToken string = substring(uniqueString(resourceGroup().id, nameSalt), 0, 5)

@description('PostgreSQL administrator login (lowercase)')
param postgresAdminLogin string = 'gccadmin'

@secure()
@description('PostgreSQL administrator password — store in Key Vault / GitHub secret')
param postgresAdminPassword string

@description('PostgreSQL major version — keep 16 unless live capabilities exclude it')
param postgresVersion string = '16'

@description('Burstable SKU name')
param postgresSkuName string = 'Standard_B1ms'

@description('Storage size GB')
param storageSizeGB int = 32

@description('Backup retention days')
param backupRetentionDays int = 14

var serverName = 'azpg${resourceToken}'

resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: serverName
  location: postgresLocation
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
      backupRetentionDays: backupRetentionDays
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
    postgresLocation: postgresLocation
    gccComputeLocation: location
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

resource requireTls 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2024-08-01' = {
  parent: postgresServer
  name: 'require_secure_transport'
  properties: {
    value: 'on'
    source: 'user-override'
  }
}

output postgresServerName string = postgresServer.name
output postgresFqdn string = postgresServer.properties.fullyQualifiedDomainName
output postgresDatabaseName string = gccDatabase.name
output postgresLocationOut string = postgresServer.location
output postgresVersionOut string = postgresServer.properties.version
output postgresSkuOut string = postgresServer.sku.name
output postgresBackupRetentionDays int = backupRetentionDays
output postgresConnectionHint string = 'postgresql://${postgresAdminLogin}@${postgresServer.properties.fullyQualifiedDomainName}:5432/${gccDatabase.name}?sslmode=require'
