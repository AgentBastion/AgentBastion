use openidconnect::core::{CoreAuthenticationFlow, CoreClient, CoreProviderMetadata};
use openidconnect::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, IssuerUrl, Nonce,
    RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// User info extracted from OIDC token.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcUserInfo {
    pub subject: String,
    pub email: Option<String>,
    pub name: Option<String>,
    pub issuer: String,
}

/// OIDC configuration — stored and used to create auth URLs and exchange codes.
#[derive(Clone)]
pub struct OidcManager {
    inner: Arc<OidcInner>,
}

struct OidcInner {
    provider_metadata: CoreProviderMetadata,
    client_id: ClientId,
    client_secret: ClientSecret,
    redirect_url: RedirectUrl,
    auth_url: AuthUrl,
    token_url: TokenUrl,
    http_client: openidconnect::reqwest::Client,
    issuer: String,
}

impl OidcManager {
    /// Discover OIDC provider metadata and build the manager.
    pub async fn discover(
        issuer_url: &str,
        client_id: &str,
        client_secret: &str,
        redirect_url: &str,
    ) -> anyhow::Result<Self> {
        let issuer = IssuerUrl::new(issuer_url.to_string())?;
        let http_client = openidconnect::reqwest::Client::new();

        let provider_metadata =
            CoreProviderMetadata::discover_async(issuer.clone(), &http_client)
                .await
                .map_err(|e| anyhow::anyhow!("OIDC discovery failed: {e}"))?;

        let auth_url = provider_metadata.authorization_endpoint().clone();
        let token_url = provider_metadata
            .token_endpoint()
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("OIDC provider has no token endpoint"))?;

        Ok(Self {
            inner: Arc::new(OidcInner {
                provider_metadata,
                client_id: ClientId::new(client_id.to_string()),
                client_secret: ClientSecret::new(client_secret.to_string()),
                redirect_url: RedirectUrl::new(redirect_url.to_string())?,
                auth_url,
                token_url,
                http_client,
                issuer: issuer_url.to_string(),
            }),
        })
    }

    /// Generate the authorization URL to redirect the user to.
    pub fn authorize_url(&self) -> (String, CsrfToken, Nonce) {
        let client = CoreClient::from_provider_metadata(
            self.inner.provider_metadata.clone(),
            self.inner.client_id.clone(),
            Some(self.inner.client_secret.clone()),
        )
        .set_auth_uri(self.inner.auth_url.clone())
        .set_token_uri(self.inner.token_url.clone())
        .set_redirect_uri(self.inner.redirect_url.clone());

        let (auth_url, csrf_token, nonce) = client
            .authorize_url(
                CoreAuthenticationFlow::AuthorizationCode,
                CsrfToken::new_random,
                Nonce::new_random,
            )
            .add_scope(Scope::new("openid".to_string()))
            .add_scope(Scope::new("email".to_string()))
            .add_scope(Scope::new("profile".to_string()))
            .url();

        (auth_url.to_string(), csrf_token, nonce)
    }

    /// Exchange authorization code for tokens, return user info.
    pub async fn exchange_code(
        &self,
        code: &str,
        nonce: &Nonce,
    ) -> anyhow::Result<OidcUserInfo> {
        let client = CoreClient::from_provider_metadata(
            self.inner.provider_metadata.clone(),
            self.inner.client_id.clone(),
            Some(self.inner.client_secret.clone()),
        )
        .set_auth_uri(self.inner.auth_url.clone())
        .set_token_uri(self.inner.token_url.clone())
        .set_redirect_uri(self.inner.redirect_url.clone());

        let token_response = client
            .exchange_code(AuthorizationCode::new(code.to_string()))
            .request_async(&self.inner.http_client)
            .await
            .map_err(|e| anyhow::anyhow!("Token exchange failed: {e}"))?;

        let id_token = token_response
            .id_token()
            .ok_or_else(|| anyhow::anyhow!("No ID token in response"))?;

        let verifier = client.id_token_verifier();
        let claims = id_token
            .claims(&verifier, nonce)
            .map_err(|e| anyhow::anyhow!("ID token verification failed: {e}"))?;

        let subject = claims.subject().to_string();
        let email = claims.email().map(|e| e.to_string());
        let name = claims
            .name()
            .and_then(|n| n.get(None))
            .map(|n| n.to_string());

        Ok(OidcUserInfo {
            subject,
            email,
            name,
            issuer: self.inner.issuer.clone(),
        })
    }
}
