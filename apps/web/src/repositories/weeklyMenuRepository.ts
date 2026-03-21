import { db, type WeeklyMenu, type WeeklyMenuItem } from '../db/db'

function buildDraftWeeklyMenu(
  weekStartDate: string,
  items: WeeklyMenuItem[],
  existing?: WeeklyMenu | null,
): WeeklyMenu {
  return {
    id: existing?.id,
    weekStartDate,
    items,
    status: 'draft',
    createdAt: existing?.createdAt ?? new Date(),
    updatedAt: new Date(),
  }
}

export async function getWeeklyMenuByWeekStart(weekStartDate: string): Promise<WeeklyMenu | null> {
  const menu = await db.weeklyMenus.where('weekStartDate').equals(weekStartDate).first()
  return menu ?? null
}

export async function saveWeeklyMenuDraft(
  weekStartDate: string,
  items: WeeklyMenuItem[],
  existing?: WeeklyMenu | null,
): Promise<WeeklyMenu> {
  const nextMenu = buildDraftWeeklyMenu(weekStartDate, items, existing)

  if (existing?.id != null) {
    await db.weeklyMenus.update(existing.id, {
      items,
      status: 'draft',
      updatedAt: nextMenu.updatedAt,
    })
  } else {
    const id = await db.weeklyMenus.add(nextMenu)
    nextMenu.id = id
  }

  return nextMenu
}

export async function updateWeeklyMenuItems(menu: WeeklyMenu, items: WeeklyMenuItem[]): Promise<WeeklyMenu> {
  const updatedMenu: WeeklyMenu = {
    ...menu,
    items,
    updatedAt: new Date(),
  }

  if (menu.id != null) {
    await db.weeklyMenus.update(menu.id, {
      items,
      updatedAt: updatedMenu.updatedAt,
    })
  }

  return updatedMenu
}
