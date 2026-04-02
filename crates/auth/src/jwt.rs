use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    pub sub: Uuid,
    pub email: String,
    pub roles: Vec<String>,
    pub exp: i64,
    pub iat: i64,
    pub token_type: String, // "access" or "refresh"
}

pub struct JwtManager {
    encoding_key: EncodingKey,
    decoding_key: DecodingKey,
}

impl JwtManager {
    pub fn new(secret: &str) -> Self {
        Self {
            encoding_key: EncodingKey::from_secret(secret.as_bytes()),
            decoding_key: DecodingKey::from_secret(secret.as_bytes()),
        }
    }

    pub fn create_access_token(
        &self,
        user_id: Uuid,
        email: &str,
        roles: Vec<String>,
    ) -> anyhow::Result<String> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id,
            email: email.to_string(),
            roles,
            exp: (now + Duration::minutes(15)).timestamp(),
            iat: now.timestamp(),
            token_type: "access".to_string(),
        };
        Ok(encode(&Header::default(), &claims, &self.encoding_key)?)
    }

    pub fn create_refresh_token(
        &self,
        user_id: Uuid,
        email: &str,
        roles: Vec<String>,
    ) -> anyhow::Result<String> {
        let now = Utc::now();
        let claims = Claims {
            sub: user_id,
            email: email.to_string(),
            roles,
            exp: (now + Duration::days(7)).timestamp(),
            iat: now.timestamp(),
            token_type: "refresh".to_string(),
        };
        Ok(encode(&Header::default(), &claims, &self.encoding_key)?)
    }

    pub fn verify_token(&self, token: &str) -> anyhow::Result<Claims> {
        let token_data = decode::<Claims>(token, &self.decoding_key, &Validation::default())?;
        Ok(token_data.claims)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_jwt_manager() -> JwtManager {
        JwtManager::new("test-secret-key-for-unit-tests")
    }

    fn test_user_id() -> Uuid {
        Uuid::parse_str("550e8400-e29b-41d4-a716-446655440000").unwrap()
    }

    #[test]
    fn access_token_roundtrip() {
        let mgr = test_jwt_manager();
        let uid = test_user_id();
        let token = mgr
            .create_access_token(uid, "alice@example.com", vec!["admin".into()])
            .expect("create should succeed");

        let claims = mgr.verify_token(&token).expect("verify should succeed");
        assert_eq!(claims.sub, uid);
        assert_eq!(claims.email, "alice@example.com");
        assert_eq!(claims.token_type, "access");
        assert_eq!(claims.roles, vec!["admin"]);
    }

    #[test]
    fn expired_token_fails_verification() {
        let mgr = test_jwt_manager();
        let uid = test_user_id();

        // Manually create an already-expired token
        let now = Utc::now();
        let claims = Claims {
            sub: uid,
            email: "bob@example.com".into(),
            roles: vec![],
            exp: (now - Duration::hours(1)).timestamp(),
            iat: (now - Duration::hours(2)).timestamp(),
            token_type: "access".into(),
        };
        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(b"test-secret-key-for-unit-tests"),
        )
        .unwrap();

        let result = mgr.verify_token(&token);
        assert!(result.is_err(), "expired token must fail verification");
    }

    #[test]
    fn refresh_token_has_correct_type() {
        let mgr = test_jwt_manager();
        let uid = test_user_id();
        let token = mgr
            .create_refresh_token(uid, "carol@example.com", vec!["viewer".into()])
            .expect("create should succeed");

        let claims = mgr.verify_token(&token).expect("verify should succeed");
        assert_eq!(claims.token_type, "refresh");
    }
}
