module.exports = {
  apps: [{
    name: "animal-rescue-backend",
    script: "./index.js",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
    }
  }]
};
