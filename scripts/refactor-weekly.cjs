const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'pages', 'WeeklyMenuPage.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Update imports
content = content.replace(
    /import { selectWeeklyMenu, getWeekStartDate }([\s\S]*?)import { createWeeklyMenuShareCode, parseWeeklyMenuShareCode } from '\.\.\/utils\/weeklyMenuShare'/m,
    `import { useWeeklyMenu } from '../hooks/useWeeklyMenu'
import { aggregateIngredients, getMissingWeeklyIngredients, formatWeeklyShoppingList } from '../utils/weeklyShoppingUtils'
import { registerWeeklyMenuToCalendar, registerShoppingListToCalendar } from '../utils/weeklyMenuCalendar'
import { calculateMatchRate, calculateMultiRecipeSchedule, isHelsioDeli } from '../utils/recipeUtils'
import { EditableShoppingList } from '../components/EditableShoppingList'`
);

// 2. Insert hook call and replace states
const stateStart = content.indexOf('const [weekStart, setWeekStart]');
const stateEnd = content.indexOf('// Swap recipe');
if (stateStart !== -1 && stateEnd !== -1) {
    content = content.slice(0, stateStart) +
        `  const {
    weekStart,
    weekStartStr,
    menu,
    recipes,
    generating,
    selectedRecipes,
    shareCode,
    handleGenerate,
    handleToggleLock,
    handleUpdateItem,
    adjustWeek,
    applySharedMenu,
    setRecipes,
  } = useWeeklyMenu()

  ` + content.slice(stateEnd);
}

// 3. Update handleSelectSwap
content = content.replace(
    /const handleSelectSwap = useCallback\(async \(recipe: Recipe\) => \{[\s\S]*?\}, \[menu, swapDayIndex, swapType\]\)/,
    `const handleSelectSwap = useCallback(async (recipe: Recipe) => {
    if (!menu || swapDayIndex === null) return
    if (!isRecipeAllowedForRole(recipe, swapType === 'main' ? 'main' : 'side')) {
      alert('選択したレシピはこの枠に割り当てできません。')
      return
    }
    handleUpdateItem(swapDayIndex, recipe.id!, swapType)
    setRecipes(prev => new Map(prev).set(recipe.id!, recipe))
    setSwapDayIndex(null)
  }, [menu, swapDayIndex, swapType, handleUpdateItem, setRecipes])`
);

// 4. Remove selectedRecipes
content = content.replace(
    /const selectedRecipes = useMemo\(\(\) => \{[\s\S]*?\}, \[menu, recipes\]\)/,
    ''
);

// 5. Remove adjustWeek
content = content.replace(
    /const adjustWeek = \(delta: number\) => \{[\s\S]*?\}\n/,
    ''
);

// 6. Remove shareCode and applySharedMenu
content = content.replace(
    /const shareCode = useMemo\(\(\) => \{[\s\S]*?\}, \[menu, weekStartStr\]\)/,
    ''
);

content = content.replace(
    /const applySharedMenu = useCallback\(async \(code: string\) => \{[\s\S]*?\}, \[loadRecipes\]\)/,
    ''
);

fs.writeFileSync(filePath, content, 'utf-8');
console.log('WeeklyMenuPage.tsx refactored successfully.');
