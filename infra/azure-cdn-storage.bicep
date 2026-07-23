targetScope = 'resourceGroup'

@description('Azure region for the storage account.')
param location string = resourceGroup().location

@minLength(3)
@maxLength(24)
@description('Globally unique storage account name. Lowercase letters and numbers only.')
param storageAccountName string = 'cmscdn6c9105a7'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  kind: 'StorageV2'
  sku: {
    name: 'Standard_LRS'
  }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    publicNetworkAccess: 'Enabled'
    supportsHttpsTrafficOnly: true
  }
}

output storageAccount string = storageAccount.name
output staticWebsiteEndpoint string = storageAccount.properties.primaryEndpoints.web
