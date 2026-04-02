use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

pub async fn create_pool(database_url: &str) -> anyhow::Result<PgPool> {
    if !database_url.contains("sslmode=") {
        tracing::warn!("DATABASE_URL does not specify sslmode. Use sslmode=require in production.");
    }

    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await?;

    tracing::info!("Database connection pool created");
    Ok(pool)
}

pub async fn run_migrations(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::migrate!("../../migrations").run(pool).await?;
    tracing::info!("Database migrations applied");
    Ok(())
}
