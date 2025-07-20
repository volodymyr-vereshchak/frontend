# HLViewer Frontend - Контекст проекта

## Обзор проекта
HLViewer - это Dash-based веб-приложение для просмотра архивных данных газовых линий. Приложение взаимодействует с FastAPI backend'ом и предоставляет интерфейс для работы с различными типами архивов.

## Архитектура
- **Frontend**: Dash (Python)
- **Backend**: FastAPI
- **Стили**: Bootstrap (Darkly theme)
- **Таблицы**: Dash AG Grid
- **Графики**: Plotly

## Структура проекта
```
frontend/
├── api/                    # API клиенты
├── pages/                  # Страницы приложения
│   ├── callbacks/         # Модульные callback'ы
│   ├── data_porcess/      # Обработка данных
│   └── page_elements/     # UI компоненты
├── utils/                  # Утилиты
├── assets/                 # Статические файлы
└── main.py                # Главный файл приложения
```

## Выполненные улучшения

### ✅ Приоритет 1: Улучшение обработки ошибок в API клиентах
- Добавлена retry логика в BaseClient
- Созданы кастомные исключения
- Улучшено логирование
- Добавлены UI компоненты для отображения ошибок
- Созданы валидаторы входных данных

### ✅ Приоритет 2: Рефакторинг callback'ов
- Создана модульная структура callback'ов:
  - `table_callbacks.py` - обновление таблиц
  - `download_callbacks.py` - загрузка файлов
  - `graph_callbacks.py` - обновление графиков
  - `utility_callbacks.py` - утилитарные функции
- Добавлена валидация входных данных
- Улучшена обработка ошибок
- Добавлены type hints и документация

## Страницы приложения
1. **daily_archive.py** (`/`) - Суточный архив
2. **hourly_archive.py** (`/hour`) - Часовой архив
3. **sys_archive.py** (`/sys`) - Архив аварий
4. **edit_archive.py** (`/edit`) - Архив вмешательств
5. **param_archive.py** (`/param`) - Параметры

## API Endpoints (исправлены)
- `daily/` - суточный архив
- `hourly/` - часовой архив
- `sys/` - системный архив
- `edit/` - архив вмешательств
- `param/` - параметры
- `gas-volume-calcs/` - расчеты объемов газа
- `lines/` - линии

## Следующие приоритеты

### 🔄 Приоритет 3: Кэширование и оптимизация производительности
- Добавить кэширование API запросов
- Оптимизировать загрузку данных
- Добавить индикаторы загрузки
- Реализовать lazy loading

### 🔄 Приоритет 4: Улучшение UI/UX
- Добавить анимации и переходы
- Улучшить отзывчивость интерфейса
- Добавить дополнительные фильтры
- Улучшить мобильную версию

## Ключевые файлы

### API Клиенты
- `api/base_client.py` - базовый класс с retry логикой
- `api/daily_archive_client.py` - клиент суточного архива
- `api/hourly_archive_client.py` - клиент часового архива
- `api/sys_archive_client.py` - клиент системного архива
- `api/edit_archive_client.py` - клиент архива вмешательств
- `api/param_client.py` - клиент параметров

### Callback'ы
- `pages/callbacks/table_callbacks.py` - обновление таблиц
- `pages/callbacks/download_callbacks.py` - загрузка файлов
- `pages/callbacks/graph_callbacks.py` - обновление графиков
- `pages/callbacks/utility_callbacks.py` - утилитарные функции

### Утилиты
- `utils/validators.py` - валидация входных данных
- `utils/logger.py` - настройка логирования

### UI Компоненты
- `pages/page_elements/error_elements.py` - компоненты ошибок
- `pages/page_elements/table_elements.py` - элементы таблиц
- `pages/page_elements/graph_elements.py` - элементы графиков

## Конфигурация
- `config.py` - основные настройки
- `.env` - переменные окружения (API hostname: localhost)
- `requirements.txt` - зависимости

## Запуск проекта
```bash
cd /d/Projects/HLViewer/frontend
python main.py
```

## Git репозиторий
- Локальный репозиторий: `front_repo`
- Последний коммит: "Priority 2: Refactor callbacks into modular structure with improved error handling"

## Текущее состояние
✅ Приоритет 1: Завершен (улучшена обработка ошибок)
✅ Приоритет 2: Завершен (рефакторинг callback'ов)
🔄 Приоритет 3: Готов к началу (кэширование и производительность)
🔄 Приоритет 4: Ожидает (UI/UX улучшения)

## Проблемы и решения
1. **DNS resolution для "fastapi_app"** - решено изменением hostname на localhost
2. **Неправильные API endpoints** - исправлены согласно OpenAPI спецификации
3. **Отсутствие обработки ошибок** - добавлена comprehensive error handling
4. **Дублирование кода в callback'ах** - решено модульной структурой

## Следующие шаги
1. Протестировать текущие улучшения
2. Начать работу над Приоритетом 3 (кэширование)
3. Или перейти к Приоритету 4 (UI/UX) 