const target = process.env['BACKEND_URL'] || 'https://localhost:7052';

module.exports = {
  '/api': {
    target,
    secure: false,
    changeOrigin: true,
  },
};
