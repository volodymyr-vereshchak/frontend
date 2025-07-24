import dash_bootstrap_components as dbc
from dash import html, dcc
import pandas as pd


def create_accordion_group(group_data, children_items, group_id):
    """Create an accordion group with gas volume calculation"""
    return dbc.AccordionItem(
        [
            # Children items as list group
            dbc.ListGroup(
                children_items,
                flush=True,
                style={"borderRadius": "0"}
            )
        ],
        title=f"🧮 {group_data['name_gas_volume']}",
        item_id=f"accordion-{group_id}",
        style={
            "backgroundColor": "#2a2a2a",
            "border": "1px solid #3a3a3a",
            "marginBottom": "4px"
        }
    )


def create_accordion_item(item_data, is_selected=False):
    """Create an accordion item (line) with selection state"""
    item_id = item_data['id']
    item_name = item_data['name']
    
    # Style based on selection state
    item_style = {
        "backgroundColor": "#4caf50" if is_selected else "#1a1a1a",
        "border": "1px solid #4caf50" if is_selected else "#2a2a2a",
        "color": "#ffffff" if is_selected else "#9e9e9e",
        "fontWeight": "bold" if is_selected else "normal",
        "cursor": "pointer",
        "padding": "8px 12px",
        "transition": "all 0.2s ease"
    }
    
    return dbc.ListGroupItem(
        [
            html.Span("🔗", style={"marginRight": "8px"}),
            html.Span(item_name)
        ],
        id={"type": "accordion-item", "index": item_id},
        action=True,
        style=item_style,
        className="accordion-item",
        n_clicks=0
    )


def build_accordion_structure(accordion_data, selected_items=None):
    """Build accordion structure from flat data"""
    if accordion_data.empty:
        return []
    
    if selected_items is None:
        selected_items = []
    
    accordion_items = []
    
    # Group data by gas_volume_calc_id
    groups = {}
    lines = []
    
    for _, row in accordion_data.iterrows():
        if pd.notna(row.get('name_gas_volume')):
            # This is a gas volume calculation group
            group_id = row.get('gas_volume_calc_id') or row.get('flow_id')
            if group_id:
                groups[group_id] = row
        else:
            # This is a line
            lines.append(row)
    
    # Create accordion structure
    for group_id, group_data in groups.items():
        # Find children for this group
        children = [line for line in lines if line.get('gas_volume_calc_id') == group_id]
        children_items = [
            create_accordion_item(child, child['id'] in selected_items) 
            for child in children
        ]
        
        # Create group with children
        accordion_items.append(create_accordion_group(group_data, children_items, group_id))
    
    return accordion_items


def get_accordion_view(id_name: str, data: pd.DataFrame, multiple: bool = True, selected_items=None):
    """Create accordion view component for lines hierarchy"""
    if data.empty:
        return dbc.Alert(
            "Нет данных для отображения",
            title="Пусто",
            color="warning",
            className="mt-3"
        )
    
    accordion_items = build_accordion_structure(data, selected_items)
    
    return html.Div([
        dbc.Accordion(
            accordion_items,
            id=id_name,
            start_collapsed=False,
            style={
                "backgroundColor": "#1a1a1a",
                "border": "1px solid #2a2a2a",
                "borderRadius": "4px",
                "maxHeight": "75vh",
                "overflowY": "auto"
            }
        ),
        # Hidden div to store selected items
        dcc.Store(id=f"{id_name}_selected", data=selected_items or [])
    ])


def get_accordion_with_header(id_name: str, data: pd.DataFrame, header_text: str, multiple: bool = True, selected_items=None):
    """Create accordion view with header"""
    return html.Div([
        html.H6(
            header_text,
            className="text-center text-white mb-3"
        ),
        get_accordion_view(id_name, data, multiple, selected_items)
    ])


def get_accordion_of_lines(id_name: str, data: pd.DataFrame, multiple: bool = True):
    """Create accordion view for lines selection (replaces get_table_of_lines)"""
    return get_accordion_with_header(
        id_name, 
        data, 
        "Список узлов учета", 
        multiple
    ) 