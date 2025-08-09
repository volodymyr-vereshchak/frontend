import dash_bootstrap_components as dbc
from dash import html, dcc


def create_report_modal():
    """Создает модальное окно для отображения отчета"""
    return dbc.Modal(
        [
            dbc.ModalHeader(
                dbc.ModalTitle("Отчет по объемам газа за последние 24 часа"),
                close_button=True,
            ),
            dbc.ModalBody(
                [
                    dcc.Loading(
                        id="report_loading",
                        children=[
                            html.Div(
                                id="report_content",
                                children="Нажмите кнопку 'Отчет ГРС' для получения данных"
                            )
                        ],
                        type="default",
                    )
                ]
            ),
            dbc.ModalFooter(
                [
                    dbc.Button(
                        "Обновить",
                        id="refresh_report_button",
                        color="primary",
                        className="me-2"
                    ),
                    dbc.Button(
                        "Закрыть",
                        id="close_report_modal",
                        color="secondary"
                    )
                ]
            ),
        ],
        id="report_modal",
        is_open=False,
        size="lg",
        scrollable=True,
    )


def format_report_message(message: str) -> html.Div:
    """Форматирует сообщение отчета для отображения в HTML"""
    if not message:
        return html.Div("Нет данных для отображения", className="text-muted")
    
    # Разбиваем сообщение на строки
    lines = message.split('\n')
    formatted_lines = []
    
    for line in lines:
        if not line.strip():
            # Пустая строка - добавляем небольшой отступ
            formatted_lines.append(html.Br())
        elif line.startswith('Объем по ГРС'):
            # Заголовок отчета
            formatted_lines.append(
                html.H4(line, className="text-primary mb-3 fw-bold")
            )
        elif ' - ' in line and ':' in line and ('202' in line or '203' in line):
            # Строка с диапазоном дат
            formatted_lines.append(
                html.P(line, className="text-info mb-3 fw-semibold")
            )
        elif 'всего:' in line and 'ГРС' in line:
            # Общий объем (удаляем HTML теги)
            clean_line = line.replace('<b>', '').replace('</b>', '')
            formatted_lines.append(
                html.H5(clean_line, className="text-success mb-3 fw-bold")
            )
        elif '<b>' in line and '</b>' in line and ('м³' in line or 'кг/см²' in line):
            # Строка с данными по конкретной линии (удаляем HTML теги)
            clean_line = line.replace('<b>', '').replace('</b>', '')
            
            # Проверяем, есть ли эмодзи внимания (красный круг)
            has_warning = '🔴' in line
            
            # Разделяем название линии и данные
            if ':' in clean_line:
                parts = clean_line.split(':', 1)
                line_name = parts[0].strip()
                line_data = parts[1].strip() if len(parts) > 1 else ''
                
                # Создаем элемент с предупреждением или без
                if has_warning:
                    formatted_lines.append(
                        html.Div([
                            html.Span("⚠️ ", className="text-warning"),
                            html.Span(f"{line_name}: ", className="fw-bold text-warning"),
                            html.Span(line_data, className="text-white")
                        ], className="mb-2 p-2 bg-dark rounded")
                    )
                else:
                    formatted_lines.append(
                        html.Div([
                            html.Span(f"{line_name}: ", className="fw-bold text-primary"),
                            html.Span(line_data, className="text-white")
                        ], className="mb-2 p-2 bg-secondary rounded")
                    )
            else:
                # Если формат не распознан, выводим как есть
                formatted_lines.append(
                    html.P(clean_line, className="mb-2 font-monospace text-light")
                )
        elif line.strip() and ('м³' in line or 'кг/см²' in line):
            # Другие строки с данными
            formatted_lines.append(
                html.P(line, className="mb-1 font-monospace text-light")
            )
        elif line.strip():
            # Любые другие непустые строки
            formatted_lines.append(
                html.P(line, className="mb-1 text-light")
            )
    
    return html.Div(
        formatted_lines,
        className="report-content",
        style={
            "backgroundColor": "#212529",
            "padding": "20px",
            "borderRadius": "8px",
            "border": "1px solid #495057",
            "color": "#ffffff"
        }
    )
