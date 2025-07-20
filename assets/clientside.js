if (!window.dash_clientside) {
    window.dash_clientside = {};
}

window.dash_clientside.clientside = {
    handleTreeItemClick: function(n_clicks_daily, n_clicks_hourly, n_clicks_sys, n_clicks_edit, n_clicks_param, 
                                  id_daily, id_hourly, id_sys, id_edit, id_param) {
        // Get the triggered component
        const ctx = window.dash_clientside.callback_context;
        if (!ctx || !ctx.triggered || ctx.triggered.length === 0) {
            return { selected_ids: [] };
        }
        
        const triggeredId = ctx.triggered[0].prop_id.split('.')[0];
        
        // Find the clicked element
        const clickedElement = document.querySelector(`#${triggeredId} .tree-item`);
        if (!clickedElement) {
            return { selected_ids: [] };
        }
        
        // Get the item ID from the element
        const itemId = clickedElement.id;
        if (!itemId || !itemId.startsWith('tree_item_')) {
            return { selected_ids: [] };
        }
        
        // Check if it's a line-level item (not a group)
        const actualId = itemId.replace('tree_item_', '');
        if (actualId.startsWith('lumg_') || actualId.startsWith('gas_calc_')) {
            return { selected_ids: [] };
        }
        
        // Toggle selection
        const currentSelection = window.treeSelection || [];
        let newSelection;
        
        if (currentSelection.includes(itemId)) {
            // Remove from selection
            newSelection = currentSelection.filter(id => id !== itemId);
        } else {
            // Add to selection
            newSelection = [...currentSelection, itemId];
        }
        
        // Update visual state
        updateTreeItemSelection(itemId, newSelection.includes(itemId));
        
        // Store current selection
        window.treeSelection = newSelection;
        
        return { selected_ids: newSelection };
    }
};

function updateTreeItemSelection(itemId, isSelected) {
    const element = document.getElementById(itemId);
    if (element) {
        if (isSelected) {
            element.style.backgroundColor = '#4a9eff';
            element.style.borderColor = '#4a9eff';
        } else {
            element.style.backgroundColor = '#2a2a2a';
            element.style.borderColor = '#3a3a3a';
        }
    }
}

// Add click event listeners to tree items
document.addEventListener('DOMContentLoaded', function() {
    // Initialize tree selection
    window.treeSelection = [];
    
    // Add click handlers to tree items
    function addTreeItemHandlers() {
        const treeItems = document.querySelectorAll('.tree-item');
        treeItems.forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                const itemId = this.id;
                if (!itemId || !itemId.startsWith('tree_item_')) {
                    return;
                }
                
                // Check if it's a line-level item
                const actualId = itemId.replace('tree_item_', '');
                if (actualId.startsWith('lumg_') || actualId.startsWith('gas_calc_')) {
                    return;
                }
                
                // Toggle selection
                const currentSelection = window.treeSelection || [];
                let newSelection;
                
                if (currentSelection.includes(itemId)) {
                    newSelection = currentSelection.filter(id => id !== itemId);
                } else {
                    newSelection = [...currentSelection, itemId];
                }
                
                // Update visual state
                updateTreeItemSelection(itemId, newSelection.includes(itemId));
                
                // Store current selection
                window.treeSelection = newSelection;
                
                // Trigger callback
                const event = new CustomEvent('treeItemClick', {
                    detail: { selected_ids: newSelection }
                });
                document.dispatchEvent(event);
            });
        });
    }
    
    // Initial setup
    addTreeItemHandlers();
    
    // Re-setup when DOM changes (for dynamic content)
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                addTreeItemHandlers();
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}); 