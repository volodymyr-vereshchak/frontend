import dash_bootstrap_components as dbc
from dash import html
import pandas as pd


def create_tree_group(group_data, children_items):
    """Create a collapsible tree group"""
    group_id = group_data['id']
    group_name = group_data['name']
    
    return html.Div([
        # Group header (clickable to expand/collapse)
        html.Div([
            html.Span("🧮", style={"marginRight": "8px"}),
            html.Span(
                "▼ " + group_name,  # Arrow + name
                style={
                    "color": "#4caf50",
                    "fontWeight": "bold",
                    "cursor": "pointer"
                },
                id={"type": "tree-group-header", "index": group_id},
                n_clicks=0
            )
        ], style={
            "padding": "6px 8px",
            "margin": "2px 0",
            "borderRadius": "4px",
            "backgroundColor": "transparent",
            "border": "none",
            "transition": "all 0.2s ease"
        }, className="tree-group-header"),
        
        # Children container (initially visible)
        html.Div(
            children_items,
            id={"type": "tree-children", "index": group_id},
            style={
                "marginLeft": "20px",
                "display": "block"  # Initially visible
            },
            className="tree-children"
        )
    ], className="tree-group")


def create_tree_item(item_data):
    """Create a tree item (line)"""
    import logging
    logger = logging.getLogger(__name__)
    print(f"Creating tree item with ID: {item_data['id']}, name: {item_data['name']}")
    logger.info(f"Creating tree item with ID: {item_data['id']}, name: {item_data['name']}")
    
    return html.Div([
        html.Span("🔗", style={"marginRight": "8px"}),
        html.Span(
            item_data['name'],
            style={
                "color": "#9e9e9e",
                "fontWeight": "normal",
                "cursor": "pointer"
            },
            id={"type": "tree-item-text", "index": item_data['id']},
            n_clicks=0
        )
    ], style={
        "padding": "6px 8px",
        "margin": "2px 0",
        "borderRadius": "4px",
        "backgroundColor": "#2a2a2a",
        "border": "1px solid #3a3a3a",
        "transition": "all 0.2s ease"
    }, id=f"tree_item_{item_data['id']}", className="tree-item")


def build_tree_structure(tree_data):
    """Build hierarchical tree structure from flat data"""
    import logging
    logger = logging.getLogger(__name__)
    
    print(f"Building tree structure from {len(tree_data)} rows")
    if tree_data.empty:
        print("Tree data is empty")
        logger.warning("Tree data is empty")
        return []
    
    logger.info(f"Building tree structure from {len(tree_data)} rows")
    tree_items = []
    
    # Group data by parent_id
    groups = {}
    lines = []
    
    for _, row in tree_data.iterrows():
        if row['level'] == 'gas_calc':
            groups[row['id']] = row
            logger.info(f"Found gas_calc group: {row['id']} - {row['name']}")
        elif row['level'] == 'line':
            lines.append(row)
            logger.info(f"Found line: {row['id']} - {row['name']}")
    
    logger.info(f"Found {len(groups)} groups and {len(lines)} lines")
    
    # Create tree structure
    for group_id, group_data in groups.items():
        # Find children for this group
        children = [line for line in lines if line['parent_id'] == group_id]
        logger.info(f"Group {group_id} has {len(children)} children")
        children_items = [create_tree_item(child) for child in children]
        
        # Create group with children
        tree_items.append(create_tree_group(group_data, children_items))
    
    logger.info(f"Created {len(tree_items)} tree groups")
    return tree_items


def get_tree_view(id_name: str, data: pd.DataFrame, multiple: bool = True):
    """Create tree view component for lines hierarchy"""
    if data.empty:
        return dbc.Alert(
            "Нет данных для отображения",
            title="Пусто",
            color="warning",
            className="mt-3"
        )
    
    tree_items = build_tree_structure(data)
    
    return html.Div([
        html.Div(
            tree_items,
            id=id_name,
            style={
                "backgroundColor": "#1a1a1a",
                "color": "white",
                "border": "1px solid #2a2a2a",
                "borderRadius": "4px",
                "padding": "8px",
                "maxHeight": "75vh",
                "overflowY": "auto",
                "fontSize": "14px"
            }
        )
    ])


def get_tree_view_with_header(id_name: str, data: pd.DataFrame, header_text: str, multiple: bool = True):
    """Create tree view with header"""
    return html.Div([
        html.H6(
            header_text,
            className="text-center text-white mb-3"
        ),
        get_tree_view(id_name, data, multiple)
    ]) 