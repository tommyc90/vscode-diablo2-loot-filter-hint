const vscode = require('vscode');
const fs = require('fs');

const ITEMS_DATA_FILES = [
    `${__dirname}/../data/items-armor.json`,
    `${__dirname}/../data/items-weapon.json`
];

const KEYWORDS_CONDITION_DATA_FILES = [
    `${__dirname}/../data/keywords-condition.json`
];

const KEYWORDS_ACTION_DATA_FILES = [
    `${__dirname}/../data/keywords-action.json`
];

const KEYWORDS_CONDITION = 1;
const KEYWORDS_ACTION = 2;

const TIERED_ITEMS = ["ARMOR", "WEAPON", "CL1", "CL2", "CL3", "CL4", "CL5", "CL6", "CL7"];

const ITEM_TIERS = {
    1: "Normal",
    2: "Exceptional",
    3: "Elite"
};

const RELATED_ITEMS_LIMIT = 5;

let completionItems = [],
    completionConditionKeywords = [],
    completionActionKeywords = [],
    hoverItems = [],
    keywordNames = [];
    
/**
 * Initialize all completion and hover data
 */
function init() {
    let keywordsCondition = [].concat.apply([], KEYWORDS_CONDITION_DATA_FILES.map(file => require(file)));
    processKeywords(keywordsCondition, KEYWORDS_CONDITION);
    let keywordsAction = [].concat.apply([], KEYWORDS_ACTION_DATA_FILES.map(file => require(file)));
    processKeywords(keywordsAction, KEYWORDS_ACTION);
    let items = [].concat.apply([], ITEMS_DATA_FILES.map(file => require(file)));
    processItems(items, null, []);
}

//#region Keywords processing

/**
 * Recursively processes all keywords data
 * @param {object} keywords 
 * @param {number} keywordsType 
 */
function processKeywords(keywords, keywordsType) {
    keywords.forEach(keyword => {
        // add only "leaf" items
        if (keyword.id !== undefined && keyword.data === undefined) {
            let completionItem = new vscode.CompletionItem(keyword.id);
            completionItem.kind = vscode.CompletionItemKind.Keyword;
            completionItem.insertText = keyword.id;
            completionItem.documentation = keyword.name !== undefined ? keyword.name : null;
            if (keywordsType === KEYWORDS_CONDITION) {
                completionConditionKeywords.push(completionItem);
            } else {
                completionActionKeywords.push(completionItem);
            }
            if (keyword.name !== undefined) {
                keywordNames[keyword.id] = keyword.name;
                hoverItems[keyword.id] = new vscode.Hover(keyword.name);
            }
        }
        // recursive call with updated context
        if (keyword.data !== undefined) {
            processKeywords(keyword.data, keywordsType);
        }
    });
}

//#endregion

//#region Items processing

/**
 * Recursively processes all items data
 * @param {object} items 
 * @param {object} parentItem 
 * @param {string[]} context 
 */
function processItems(items, parentItem, context) {
    let itemTier = 1;
    items.forEach(item => {
        // add only "leaf" items
        if (item.id !== undefined && item.data === undefined) {
            let mdDescription = getItemMdDescription(item, itemTier++, parentItem, context);
            addCompletionItem(item, mdDescription, context);
            hoverItems[item.id] = new vscode.Hover(mdDescription);
        }
        // recursive call with updated context
        if (item.data !== undefined) {
            processItems(item.data, item, item.id !== undefined ? [].concat(context, [item.id]) : context);
        }
    });
}

/**
 * @param {object} item
 * @param {string} mdDescription
 * @param {string[]} context
 */
function addCompletionItem(item, mdDescription, context) {
    const fullName = item.name !== undefined ? `${item.id}:${item.name}` : item.id;
    const completionItem = new vscode.CompletionItem(fullName);
    completionItem.insertText = item.id;
    completionItem.documentation = mdDescription;
    //completionItem.filterText = [].concat([item.id, item.name], context).join(" ");
    completionItems.push(completionItem);
}

/**
 * Prepares markdown text used for completion and hover item
 * @param {object} item
 * @param {number} itemTier
 * @param {object} parentItem
 * @param {string[]} context
 */
function getItemMdDescription(item, itemTier, parentItem, context) {
    let hoverContent = item.name !== undefined ? `**${item.name} (_${item.id}_)**` : `**${item.id}**`;
    hoverContent += "\n\n";
    // tiered equipment (armor/weapon)
    if (context.filter(value => TIERED_ITEMS.includes(value)).length > 0) {
        hoverContent += "* `Tier` - " + ITEM_TIERS[itemTier] + "  \n";
    }
    if (context.length > 0) {
        const contextNames = context.map(value => {
            return keywordNames[value] !== undefined ? keywordNames[value] : value;
        });
        hoverContent += "* `Category` - " + contextNames.join(", ") + "  \n";
    }
    
    let relatedContent = [];
    if (parentItem && parentItem.data.length <= RELATED_ITEMS_LIMIT) {
        parentItem.data.forEach(relatedItem => {
            if (relatedItem.id === item.id) {
                return;
            }
            relatedContent.push(relatedItem.name !== undefined ? `${relatedItem.name} (_${relatedItem.id}_)` : relatedItem.id);
        });
    }
    if (relatedContent.length > 0) {
        hoverContent += "* `Variants` - " + relatedContent.join(", ");
    }

    return new vscode.MarkdownString(hoverContent);
}

//#endregion

/**
 * @param {string} id
 */
function getHoverItem(id) {
    return id in hoverItems ? hoverItems[id] : null;
}

module.exports = {
    init,
    
    getCompletionItems : () => completionItems,
    getCompletionConditionKeywords : () => completionConditionKeywords,
    getCompletionActionKeywords : () => completionActionKeywords,
    
    getHoverItem
};