import { readRoute } from "@/core/mutation/handler";
import { listAllEvents, listCategories as listCalendarCategories } from "@/modules/calendar/service";
import {
  getIncome,
  listAccounts,
  listBudgets,
  listCategories as listFinanceCategories,
  listDebts,
  listTransactions,
} from "@/modules/finance/service";
import { listHistory } from "@/modules/habits/service";
import { getTrip, listTrips } from "@/modules/itinerary/service";
import { listEntries } from "@/modules/journal/service";
import { listNotes } from "@/modules/notes/service";
import { listBuckets } from "@/modules/tasks/service";
import { listItems as listVaultItems } from "@/modules/vault/service";

/**
 * The JSON export (G2). One file, every module, gathered from each module's
 * own service functions — this route never touches Prisma itself.
 *
 * Vault is ciphertext-only here, always (system design §4.4): the server
 * cannot decrypt it and must not try. The "include decrypted credentials"
 * variant is assembled entirely client-side, from this same endpoint's
 * ciphertext plus a fresh master-password unlock — see
 * modules/vault/ui/export-panel.tsx. That is also why this route has no
 * "decrypt" option to opt into: there is nothing here it could do.
 */
export const GET = readRoute(async ({ session }) => {
  const month = new Date().toISOString().slice(0, 7);

  const [
    tasks,
    journal,
    notes,
    calendarCategories,
    events,
    habits,
    accounts,
    financeCategories,
    transactions,
    budgets,
    debts,
    income,
    trips,
    vaultItems,
  ] = await Promise.all([
    listBuckets(session.userId, session.timezone),
    listEntries(session.userId),
    listNotes(session.userId),
    listCalendarCategories(session.userId),
    listAllEvents(session.userId),
    // A ten-year window stands in for "every log ever" — habits have no
    // unbounded history function, only the windowed grid Habits itself uses.
    listHistory(session.userId, month + "-01", 3650, session.weekStartsOn),
    listAccounts(session.userId),
    listFinanceCategories(session.userId),
    listTransactions(session.userId, {}),
    listBudgets(session.userId, month),
    listDebts(session.userId),
    getIncome(session.userId),
    listTrips(session.userId),
    listVaultItems(session.userId),
  ]);

  const tripDetails = await Promise.all(trips.map((trip) => getTrip(session.userId, trip.id)));

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      name: session.name,
      email: session.email,
      timezone: session.timezone,
      currency: session.currency,
    },
    tasks,
    journal,
    notes,
    calendar: { categories: calendarCategories, events },
    habits,
    finance: {
      accounts,
      categories: financeCategories,
      transactions,
      budgets,
      debts,
      income,
    },
    itinerary: tripDetails,
    vault: {
      encrypted: true,
      items: vaultItems,
    },
  };
});
