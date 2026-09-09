@description('Stable name salt — do not include region so a justified location fallback does not rename the server')
param nameSalt string = 'gcc-postgres'

output postgresServerName string = 'azpg${substring(uniqueString(resourceGroup().id, nameSalt), 0, 5)}'
