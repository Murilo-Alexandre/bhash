module.exports = {
  apps: [
    {
      name: "bhash-backend",
      cwd: "./backend",
      script: "./dist/src/main.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "bhash-frontend",
      cwd: "./frontend",
      script: "./node_modules/vite/bin/vite.js",
      args: "preview --host 0.0.0.0 --port 5173 --strictPort",
      interpreter: "node",
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "bhash-frontend-admin",
      cwd: "./frontend-admin",
      script: "./node_modules/vite/bin/vite.js",
      args: "preview --host 0.0.0.0 --port 5174 --strictPort",
      interpreter: "node",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
