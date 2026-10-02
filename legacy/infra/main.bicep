targetScope = 'resourceGroup'

@description('Azure region approved for application and data residency.')
param location string = 'westeurope'

@description('Short lowercase prefix used for new resources in this isolated resource group.')
@minLength(3)
@maxLength(10)
param appNamePrefix string = 'sapsc'

@description('GitHub Container Registry namespace that owns the private images.')
param githubOwner string

@description('Immutable image tag, normally the Git commit SHA.')
param imageTag string

@description('GitHub username allowed to pull the private GHCR images.')
param ghcrUsername string

@description('Read-only GitHub Container Registry token for App Service image pulls.')
@secure()
param ghcrReadToken string

@description('PostgreSQL administrator password. The API connection string is provisioned separately into Key Vault.')
@minLength(20)
@maxLength(128)
@secure()
param postgresAdminPassword string

@description('PostgreSQL administrator login. Use a dedicated login for this isolated pilot database.')
param postgresAdminUser string = 'scadmin'

@description('Microsoft Entra tenant that owns the API/SPA application registration.')
param entraTenantId string

@description('Microsoft Entra client/application ID for the API and SPA registration.')
param entraClientId string

@description('Delegated API scope requested by the SPA.')
param apiScope string = 'api://${entraClientId}/access_as_user'

@description('Object ID of the GitHub Actions deployment service principal, scoped to this resource group only.')
param deploymentPrincipalObjectId string

var suffix = uniqueString(subscription().id, resourceGroup().id)
var webPlanName = 'asp-${appNamePrefix}-${suffix}'
var apiSiteName = '${appNamePrefix}-${suffix}-api'
var webSiteName = '${appNamePrefix}-${suffix}-web'
var postgresServerName = '${appNamePrefix}-${suffix}-pg'
var keyVaultName = take(replace('kv-${appNamePrefix}-${suffix}', '-', ''), 24)
var privateDnsZoneName = 'privatelink.postgres.database.azure.com'
var databaseName = 'supplychain'
var apiAudience = 'api://${entraClientId}'
var authority = '${environment().authentication.loginEndpoint}${entraTenantId}'
var secretsOfficerRoleId = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
var secretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

// One low-cost Linux plan shares compute between the separately deployable UI and API apps.
resource webPlan 'Microsoft.Web/serverfarms@2025-03-01' = {
  name: webPlanName
  location: location
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
    size: 'B1'
    family: 'B'
    capacity: 1
  }
  properties: {
    reserved: true
    perSiteScaling: false
  }
}

resource virtualNetwork 'Microsoft.Network/virtualNetworks@2025-09-01' = {
  name: 'vnet-${appNamePrefix}-${suffix}'
  location: location
  properties: {
    addressSpace: {
      addressPrefixes: [
        '10.42.0.0/16'
      ]
    }
    subnets: [
      {
        name: 'appservice-integration'
        properties: {
          addressPrefix: '10.42.1.0/26'
          delegations: [
            {
              name: 'appservice'
              properties: {
                serviceName: 'Microsoft.Web/serverFarms'
              }
            }
          ]
        }
      }
      {
        name: 'postgres-flexible'
        properties: {
          addressPrefix: '10.42.2.0/28'
          delegations: [
            {
              name: 'postgres-flexible'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

resource privateDnsZone 'Microsoft.Network/privateDnsZones@2024-06-01' = {
  name: privateDnsZoneName
  location: 'global'
  properties: {}
}

resource privateDnsLink 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2024-06-01' = {
  parent: privateDnsZone
  name: 'link-${appNamePrefix}-${suffix}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: virtualNetwork.id
    }
  }
}

// Private access only; database compute and storage use the smallest supported pilot profile.
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2025-08-01' = {
  name: postgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminUser
    administratorLoginPassword: postgresAdminPassword
    version: '16'
    authConfig: {
      activeDirectoryAuth: 'Disabled'
      passwordAuth: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    storage: {
      storageSizeGB: 32
      autoGrow: 'Disabled'
    }
    network: {
      delegatedSubnetResourceId: resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetwork.name, 'postgres-flexible')
      privateDnsZoneArmResourceId: privateDnsZone.id
    }
  }
  dependsOn: [
    privateDnsLink
  ]
}

resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2025-08-01' = {
  parent: postgres
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// RBAC-only Key Vault stores tenant SAP OAuth secrets and the API's PostgreSQL URL.
resource keyVault 'Microsoft.KeyVault/vaults@2026-02-01' = {
  name: keyVaultName
  location: location
  properties: {
    tenantId: entraTenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enablePurgeProtection: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

resource apiApp 'Microsoft.Web/sites@2025-03-01' = {
  name: apiSiteName
  location: location
  kind: 'app,linux,container'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: webPlan.id
    httpsOnly: true
    virtualNetworkSubnetId: resourceId('Microsoft.Network/virtualNetworks/subnets', virtualNetwork.name, 'appservice-integration')
    siteConfig: {
      linuxFxVersion: 'DOCKER|ghcr.io/${toLower(githubOwner)}/sentinel-supply-chain-api:${imageTag}'
      alwaysOn: true
      healthCheckPath: '/readyz'
      http20Enabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '8000'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://ghcr.io'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: ghcrUsername
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: ghcrReadToken
        }
        {
          name: 'APP_ENV'
          value: 'production'
        }
        {
          name: 'AUTH_MODE'
          value: 'easyauth'
        }
        {
          name: 'DATABASE_SSLMODE'
          value: 'verify-full'
        }
        {
          name: 'DATABASE_URL'
          value: '@Microsoft.KeyVault(SecretUri=https://${keyVault.name}${environment().suffixes.keyvaultDns}/secrets/database-url/)'
        }
        {
          name: 'KEY_VAULT_URL'
          value: 'https://${keyVault.name}${environment().suffixes.keyvaultDns}/'
        }
        {
          name: 'SAP_SECRET_NAME_PREFIX'
          value: 'sap-client'
        }
        {
          name: 'CORS_ORIGINS'
          value: 'https://${webSiteName}.azurewebsites.net'
        }
        {
          name: 'WEBSITE_HEALTHCHECK_MAXPINGFAILURES'
          value: '3'
        }
      ]
    }
  }
  dependsOn: [
    postgresDatabase
  ]
}

resource webApp 'Microsoft.Web/sites@2025-03-01' = {
  name: webSiteName
  location: location
  kind: 'app,linux,container'
  properties: {
    serverFarmId: webPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|ghcr.io/${toLower(githubOwner)}/sentinel-supply-chain-web:${imageTag}'
      alwaysOn: true
      healthCheckPath: '/healthz'
      http20Enabled: true
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      scmMinTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITES_PORT'
          value: '8080'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_URL'
          value: 'https://ghcr.io'
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_USERNAME'
          value: ghcrUsername
        }
        {
          name: 'DOCKER_REGISTRY_SERVER_PASSWORD'
          value: ghcrReadToken
        }
        {
          name: 'API_URL'
          value: 'https://${apiSiteName}.azurewebsites.net'
        }
        {
          name: 'ENTRA_CLIENT_ID'
          value: entraClientId
        }
        {
          name: 'ENTRA_AUTHORITY'
          value: authority
        }
        {
          name: 'API_SCOPE'
          value: apiScope
        }
      ]
    }
  }
  dependsOn: [
    apiApp
  ]
}

resource apiAuth 'Microsoft.Web/sites/config@2022-09-01' = {
  parent: apiApp
  name: 'authsettingsV2'
  properties: {
    platform: {
      enabled: true
    }
    globalValidation: {
      requireAuthentication: true
      unauthenticatedClientAction: 'Return401'
      excludedPaths: [
        '/healthz'
        '/readyz'
      ]
    }
    identityProviders: {
      azureActiveDirectory: {
        enabled: true
        registration: {
          clientId: entraClientId
          openIdIssuer: '${authority}/v2.0'
        }
        validation: {
          allowedAudiences: [
            apiAudience
          ]
          defaultAuthorizationPolicy: {
            allowedApplications: [
              entraClientId
            ]
          }
        }
      }
    }
    httpSettings: {
      requireHttps: true
      routes: {
        apiPrefix: '/.auth'
      }
    }
  }
}

resource apiSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apiSiteName, secretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUserRoleId)
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// The API writes per-tenant SAP client secrets only to this dedicated vault.
resource apiSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apiSiteName, secretsOfficerRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsOfficerRoleId)
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// This deployment identity receives secret-write access only on the newly-created application vault.
resource deploySecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, deploymentPrincipalObjectId, secretsOfficerRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsOfficerRoleId)
    principalId: deploymentPrincipalObjectId
    principalType: 'ServicePrincipal'
  }
}

output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output webUrl string = 'https://${webApp.properties.defaultHostName}'
output apiAppName string = apiApp.name
output webAppName string = webApp.name
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output postgresAdminUser string = postgresAdminUser
output keyVaultName string = keyVault.name
output appServicePlanSku string = 'Basic B1 (shared by web and API)'
output postgresSku string = 'Burstable Standard_B1ms, 32 GiB, 7-day backup, no HA'
