const vscode = require('vscode');
const fs = require('fs');

const FILTER_TYPE_POD = 'podlootfilter';
const FILTER_TYPE_PD2 = 'pd2lootfilter';

const ITEMS_DATA_FILES = [
    `${__dirname}/../data/items-armor.json`,
    `${__dirname}/../data/items-weapon.json`,
    `${__dirname}/../data/items-misc.json`
];
const ITEMS_POD_DATA_FILES = [
    `${__dirname}/../data/items-pod.json`
];
const ITEMS_PD2_DATA_FILES = [
    `${__dirname}/../data/items-pd2.json`
];

const KEYWORDS_CONDITION_DATA_FILES = [
    `${__dirname}/../data/keywords-condition.json`
];
const KEYWORDS_CONDITION_POD_DATA_FILES = [
    `${__dirname}/../data/keywords-condition-pod.json`
];
const KEYWORDS_CONDITION_PD2_DATA_FILES = [
    `${__dirname}/../data/keywords-condition-pd2.json`
];

const KEYWORDS_ACTION_DATA_FILES = [
    `${__dirname}/../data/keywords-action.json`
];
const KEYWORDS_ACTION_POD_DATA_FILES = [
    `${__dirname}/../data/keywords-action-pod.json`
];
const KEYWORDS_ACTION_PD2_DATA_FILES = [
    `${__dirname}/../data/keywords-action-pd2.json`
];

const KEYWORDS_CONDITION = 1;
const KEYWORDS_ACTION = 2;

const TIERED_ITEMS = ["ARMOR", "WEAPON"];
const TIERED_ITEMS_EXCLUDE = ["EQ7"]; // Circlets

const ITEM_TIERS = {
    1: "Normal",
    2: "Exceptional",
    3: "Elite"
};

const RELATED_ITEMS_LIMIT = 5;

let currentFilterType = null;

let completionItems = [],
    completionConditionKeywords = [],
    completionActionKeywords = [],
    conditionHoverItems = [],
    actionHoverItems = [],
    keywordNames = [];

/**
 * Initialize all completion and hover data
 */
function init(filterType) {
    // data already initialized for this filter type
    if (currentFilterType == filterType) {
        return;
    }

    // reset data
    completionItems = [];
    completionConditionKeywords = [];
    completionActionKeywords = [];
    conditionHoverItems = [];
    actionHoverItems = [];
    keywordNames = [];

    let keywordsConditionDataFiles = KEYWORDS_CONDITION_DATA_FILES,
        keywordsActionDataFiles = KEYWORDS_ACTION_DATA_FILES,
        itemsDataFiles = ITEMS_DATA_FILES;

    if (filterType == FILTER_TYPE_POD) {
        keywordsConditionDataFiles = [].concat(keywordsConditionDataFiles, KEYWORDS_CONDITION_POD_DATA_FILES);
        keywordsActionDataFiles = [].concat(keywordsActionDataFiles, KEYWORDS_ACTION_POD_DATA_FILES);
        itemsDataFiles = [].concat(itemsDataFiles, ITEMS_POD_DATA_FILES);
    } else if (filterType == FILTER_TYPE_PD2) {
        keywordsConditionDataFiles = [].concat(keywordsConditionDataFiles, KEYWORDS_CONDITION_PD2_DATA_FILES);
        keywordsActionDataFiles = [].concat(keywordsActionDataFiles, KEYWORDS_ACTION_PD2_DATA_FILES);
        itemsDataFiles = [].concat(itemsDataFiles, ITEMS_PD2_DATA_FILES);
    }

    let keywordsCondition = [].concat.apply([], keywordsConditionDataFiles.map(file => require(file)));
    processKeywords(keywordsCondition, KEYWORDS_CONDITION);
    let keywordsAction = [].concat.apply([], keywordsActionDataFiles.map(file => require(file)));
    processKeywords(keywordsAction, KEYWORDS_ACTION);
    let items = [].concat.apply([], itemsDataFiles.map(file => require(file)));
    processItems(items, null, []);

    currentFilterType = filterType;
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
            completionItem.detail = keyword.name !== undefined ? keyword.name : null;
            if (keywordsType === KEYWORDS_CONDITION) {
                completionConditionKeywords.push(completionItem);
            } else {
                completionActionKeywords.push(completionItem);
            }
            if (keyword.name !== undefined) {
                keywordNames[keyword.id] = keyword.name;
                const hoverItem = new vscode.Hover(keyword.name);
                if (keywordsType === KEYWORDS_CONDITION) {
                    conditionHoverItems[keyword.id] = hoverItem;
                } else {
                    actionHoverItems[keyword.id] = hoverItem;
                }
                
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
            conditionHoverItems[item.id] = new vscode.Hover(mdDescription);
        }
        // recursive call with updated context
        if (item.data !== undefined) {
            processItems(item.data, item, item.tags !== undefined ? [].concat(context, item.tags) : context);
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
    completionItem.detail = item.name !== undefined ? item.name : null;
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
    if (isItemTiered(context)) {
        hoverContent += "* `Tier` - " + ITEM_TIERS[itemTier] + "  \n";
    }
    if (context.length > 0) {
        const contextNames = context.map(value => {
            return keywordNames[value] !== undefined ? keywordNames[value] : value;
        });
        hoverContent += "* `Tags` - " + contextNames.join(", ") + "  \n";
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
        hoverContent += "* `Related` - " + relatedContent.join(", ");
    }

    return new vscode.MarkdownString(hoverContent);
}

/**
 * Resolves whether the item has tiers or not
 * @param {string[]} context 
 */
function isItemTiered(context) {
    const excluded = context.filter(value => TIERED_ITEMS_EXCLUDE.includes(value)).length > 0;
    if (excluded) {
        return false;
    }
    return context.filter(value => TIERED_ITEMS.includes(value)).length > 0;
}

//#endregion

/**
 * @param {string} id
 */
function getConditionHoverItem(id) {
    return id in conditionHoverItems ? conditionHoverItems[id] : null;
}

/**
 * @param {string} id
 */
function getActionHoverItem(id) {
    return id in actionHoverItems ? actionHoverItems[id] : null;
}

module.exports = {
    FILTER_TYPE_POD,
    FILTER_TYPE_PD2,

    init,
    
    getCompletionItems : () => completionItems,
    getCompletionConditionKeywords : () => completionConditionKeywords,
    getCompletionActionKeywords : () => completionActionKeywords,
    
    getConditionHoverItem,
    getActionHoverItem
};