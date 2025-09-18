// Конфигурация для сервера (dev-режим с proxy)
// Пустая строка означает использование proxy для API запросов
window.APP_CONFIG = {
  API_URL: '',  // Работает через proxy - нет проблем с CORS

  // Для production с прямыми вызовами используй:
  // API_URL: 'http://localhost:8000',
  // API_URL: 'http://IP_СЕРВЕРА:8000',

  APP_NAME: 'HostLib Viewer',
  VERSION: '1.0.0',
  BUILD_MODE: 'proxy'  // proxy или direct
};