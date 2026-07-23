targetScope = 'subscription'

@description('Azure region for the resource group and storage account.')
param location string = 'eastus2'

@description('Resource group that owns the CMS CDN origin resources.')
param resourceGroupName string = 'cms-rg'

@minLength(3)
@maxLength(24)
@description('Globally unique storage account name. Lowercase letters and numbers only.')
param storageAccountName string = 'cmscdn6c9105a7'

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-11-01' = {
  name: resourceGroupName
  location: location
}

module storageAccount './azure-cdn-storage.bicep' = {
  name: 'cms-cdn-storage-account'
  scope: resourceGroup
  params: {
    location: location
    storageAccountName: storageAccountName
  }
}

output resourceGroup string = resourceGroup.name
output storageAccount string = storageAccount.outputs.storageAccount
output staticWebsiteEndpoint string = storageAccount.outputs.staticWebsiteEndpoint
