const STORAGE_KEY = 'kartu-mvp-demo-v1';
const SESSION_KEY = 'kartu-supabase-session-v1';
const SUPABASE_CONFIG = window.KARTU_CONFIG || {};
const SUPABASE_KEY = SUPABASE_CONFIG.supabasePublishableKey || SUPABASE_CONFIG.supabaseAnonKey || '';
const REMOTE_CONFIGURED = Boolean(SUPABASE_CONFIG.supabaseUrl && SUPABASE_KEY);

const initialOffers = [
  { id: 'offer-rice', type: 'group_buy', name: 'Ilgagrūdžiai ryžiai, 10 kg', nameEn: 'Long-grain rice, 10 kg', description: 'Didmeninė pakuotė iš Lietuvos maisto produktų tiekėjo. Užsakymą atsiimkite nurodytu laiku.', descriptionEn: 'Bulk pack from a Lithuanian food supplier. Collect your order during the pickup window.', supplierId: 'sup-groceries', supplier: 'Baltijos maisto sandėlis', emoji: '🍚', tone: '#eee3ce', priceCents: 1890, unit: 'maišas', stock: 50, minimum: 20, reservedQty: 13, neighborhood: 'Naujamiestis', address: 'Kauno g. 18, Vilnius', pickup: 'Šeštadienį, 10:00–13:00', hoursLeft: 31, status: 'open', tag: 'Perkame kartu', distance: '0,8 km' },
  { id: 'offer-detergent', type: 'group_buy', name: 'Skalbiklis „Švaru“, 3,5 l', nameEn: '“Švaru” laundry detergent, 3.5 L', description: 'Koncentruotas skalbiklis tiesiai iš gamintojo. Mažesnė kaina, kai užsakome kartu.', descriptionEn: 'Concentrated detergent direct from the maker. Better price when neighbors order together.', supplierId: 'sup-home', supplier: 'Švaru namams', emoji: '🧴', tone: '#dce8ed', priceCents: 840, unit: 'butelis', stock: 35, minimum: 15, reservedQty: 12, neighborhood: 'Naujamiestis', address: 'A. Vivulskio g. 12, Vilnius', pickup: 'Penktadienį, 16:00–19:00', hoursLeft: 19, status: 'open', tag: 'Perkame kartu', distance: '1,1 km' },
  { id: 'offer-bakery', type: 'surplus', name: 'Kepyklėlės dienos rinkinys', nameEn: 'Bakery end-of-day bag', description: 'Duona, bandelės ir dienos kepiniai. Tikslus turinys gali skirtis – viskas šviežia ir tos pačios dienos.', descriptionEn: 'Bread, buns and daily pastries. Contents vary, but everything is fresh from today.', supplierId: 'sup-bakery', supplier: 'Kepyklėlė „Rytas“', emoji: '🥐', tone: '#f4e0c8', priceCents: 450, unit: 'rinkinys', stock: 15, minimum: 0, reservedQty: 7, neighborhood: 'Naujamiestis', address: 'P. Višinskio g. 7, Vilnius', pickup: 'Šiandien, 18:00–19:00', hoursLeft: 5, status: 'open', tag: 'Mažiau atliekų', distance: '0,5 km' },
  { id: 'offer-apples', type: 'group_buy', name: 'Lietuviški obuoliai, 5 kg', nameEn: 'Lithuanian apples, 5 kg', description: 'Traškūs sezono obuoliai iš ūkio. Atsiimkite visą kartoninę dėžutę.', descriptionEn: 'Crisp seasonal apples from a local farm. Collect a full box.', supplierId: 'sup-farm', supplier: 'Ūkis „Žalias laukas“', emoji: '🍎', tone: '#f2dfd6', priceCents: 700, unit: 'dėžė', stock: 24, minimum: 12, reservedQty: 8, neighborhood: 'Naujamiestis', address: 'V. Kudirkos g. 5, Vilnius', pickup: 'Šeštadienį, 9:00–12:00', hoursLeft: 42, status: 'open', tag: 'Perkame kartu', distance: '1,4 km' },
  { id: 'offer-bread', type: 'surplus', name: 'Ruginės duonos rinkinys', nameEn: 'Rye bread bundle', description: 'Dvi kepyklėlės ruginės duonos kepalų pusės – puikiai tinka šaldyti.', descriptionEn: 'Two half-loaves of the bakery’s rye bread, perfect for freezing.', supplierId: 'sup-bakery', supplier: 'Kepyklėlė „Rytas“', emoji: '🍞', tone: '#e8dccd', priceCents: 320, unit: 'rinkinys', stock: 10, minimum: 0, reservedQty: 5, neighborhood: 'Naujamiestis', address: 'P. Višinskio g. 7, Vilnius', pickup: 'Šiandien, 18:00–19:00', hoursLeft: 5, status: 'open', tag: 'Mažiau atliekų', distance: '0,5 km' },
  { id: 'offer-beans', type: 'group_buy', name: 'Baltosios pupelės, 5 kg', nameEn: 'White beans, 5 kg', description: 'Baltosios pupelės maitinimo įstaigų pakuotėje, tiesiai iš importuotojo.', descriptionEn: 'White beans in a food-service pack, direct from the importer.', supplierId: 'sup-groceries', supplier: 'Baltijos maisto sandėlis', emoji: '🫘', tone: '#e6e4d5', priceCents: 1190, unit: 'maišas', stock: 30, minimum: 15, reservedQty: 9, neighborhood: 'Naujamiestis', address: 'Kauno g. 18, Vilnius', pickup: 'Šeštadienį, 10:00–13:00', hoursLeft: 31, status: 'open', tag: 'Perkame kartu', distance: '0,8 km' },
  { id: 'offer-pending', type: 'group_buy', name: 'Avižiniai dribsniai, 5 kg', nameEn: 'Rolled oats, 5 kg', description: 'Didelė pakuotė tiesiai iš gamintojo. Laukiama pasiūlymo patvirtinimo.', descriptionEn: 'A bulk pack direct from the producer. Waiting for offer approval.', supplierId: 'sup-new', supplier: 'Grūdų namai', emoji: '🌾', tone: '#eee5cc', priceCents: 650, unit: 'maišas', stock: 40, minimum: 20, reservedQty: 0, neighborhood: 'Naujamiestis', address: 'Savanorių pr. 6, Vilnius', pickup: 'Sekmadienį, 10:00–12:00', hoursLeft: 52, status: 'pending_approval', tag: 'Perkame kartu', distance: '1,8 km' }
];

const demoUsers = {
  buyer: { id: 'demo-buyer', name: 'Rūta Petrauskė', initials: 'RP', role: 'buyer', supplierId: null },
  supplier: { id: 'demo-supplier', name: 'Mantas · Švaru namams', initials: 'MŠ', role: 'supplier', supplierId: 'sup-home' },
  admin: { id: 'demo-admin', name: 'Kartu komanda', initials: 'KK', role: 'admin', supplierId: null }
};

const words = {
  lt: {
    discover: 'Atrasti', orders: 'Mano užsakymai', supplier: 'Tiekėjo erdvė', admin: 'Administravimas', community: 'BENDRUOMENĖ', workspace: 'DARBO ERDVĖ', impactTitle: 'Geri dalykai lieka kaimynystėje', impactText: 'Kiekvienas užsakymas padeda sutaupyti ir mažina maisto švaistymą.', saved: 'užsakymų vertė', location: 'Vilnius', demo: 'Bandomasis režimas', topCrumb: 'Mano kaimynystė', hello: 'Sveiki sugrįžę', helloBuyer: 'Ką šiandien rasime?', homeSub: 'Geri pasiūlymai visai netoli jūsų.', heroTag: 'PIRKIME KARTU, MOKĖKIME MAŽIAU', heroTitle: 'Geri dalykai. Geresnė kaina.', heroText: 'Sujunkite užsakymus su kaimynais arba išgelbėkite šios dienos maistą.', explore: 'Peržiūrėti pasiūlymus', sectionOffers: 'Šalia jūsų', all: 'Visi pasiūlymai', group: 'Perkame kartu', surplus: 'Mažiau atliekų', nearby: 'Pasiūlymai rodomi', neighborhood: 'Kaimynystė', available: 'laisva', joined: 'jau prisijungė', closingToday: 'Baigiasi šiandien', details: 'Peržiūrėti', join: 'Prisijungti', per: 'už', collected: 'Surinkta', min: 'min.', bag: 'rinkinys', empty: 'Kol kas pasiūlymų nėra', emptyText: 'Patikrinkite kitą kaimynystę arba sugrįžkite vėliau.', ordersTitle: 'Mano užsakymai', ordersSub: 'Čia rasite prisijungtus grupinius pirkimus ir atsiėmimo informaciją.', noOrders: 'Dar neturite užsakymų', noOrdersText: 'Peržiūrėkite pasiūlymus ir prisijunkite prie pirmo pirkimo kartu.', browse: 'Rasti pasiūlymų', total: 'Iš viso', pickupCode: 'Atsiėmimo kodas', cancel: 'Atšaukti', reserved: 'Užsakyta', ready: 'Paruošta atsiimti', orderDone: 'Užbaigta', cancelled: 'Atšaukta', supplierTitle: 'Tiekėjo erdvė', supplierSub: 'Valdykite pasiūlymus ir pasiruoškite atsiėmimams.', newOffer: 'Naujas pasiūlymas', listings: 'Mano pasiūlymai', activeOrders: 'Aktyvūs pasiūlymai', reservedUnits: 'Rezervuota vnt.', awaiting: 'Laukia patvirtinimo', markReady: 'Paruošta atsiimti', noListings: 'Pasiūlymų dar nėra', addFirst: 'Sukurkite pirmą pasiūlymą naudodami formą dešinėje.', createOffer: 'Sukurti pasiūlymą', offerType: 'Pasiūlymo tipas', groupBuy: 'Perkame kartu', surprise: 'Mažiau atliekų · likutis', title: 'Pavadinimas', titlePlaceholder: 'Pvz., ryžiai, 10 kg', description: 'Aprašymas', price: 'Kaina (€)', unit: 'Vienetas', quantity: 'Kiekis', minimum: 'Minimalus kiekis', pickupAddress: 'Atsiėmimo adresas', pickupTime: 'Atsiėmimo laikas', publish: 'Pateikti tvirtinti', formNote: 'Naują pasiūlymą pirmiausia patvirtina programėlės administratorius.', adminTitle: 'Pasiūlymų valdymas', adminSub: 'Patikrinkite tiekėjų pateiktus pasiūlymus ir valdykite bandomąją aplinką.', review: 'Laukia peržiūros', suppliers: 'Tiekėjai', approvedOffers: 'Aktyvūs pasiūlymai', approve: 'Patvirtinti', reject: 'Atmesti', noPending: 'Nėra pasiūlymų peržiūrai', allClear: 'Nauji tiekėjų pasiūlymai pasirodys čia.', localOnly: 'Duomenys saugomi tik šiame įrenginyje. Tai nėra vieša, bendro naudojimo sistema.', roleBuyer: 'Pirkėja · Rūta', roleSupplier: 'Tiekėjas · Mantas', roleAdmin: 'Administratorius', detail: 'Pasiūlymo informacija', pickup: 'Atsiėmimas', quantityLabel: 'Kiekis', addOrder: 'Prisijungti prie užsakymo', groupProgress: 'Grupės eiga', max: 'Liko', minimumHit: 'Tikslas pasiektas', minWait: 'Laukiame kaimynų', successJoin: 'Užsakymas pridėtas. Atsiėmimo kodas: ', successCancel: 'Užsakymas atšauktas.', successApprove: 'Pasiūlymas patvirtintas.', successReject: 'Pasiūlymas atmestas.', successReady: 'Pasiūlymas pažymėtas paruoštu atsiimti.', successOffer: 'Pasiūlymas pateiktas administratoriui tvirtinti.', unavailable: 'Šio pasiūlymo nebegalima užsakyti.', notEnough: 'Nepakanka likučio pasirinktam kiekiui.', required: 'Užpildykite visus privalomus laukus.', close: 'Uždaryti', statusOpen: 'Atviras', statusMinimum: 'Tikslas pasiektas', statusPending: 'Laukia tvirtinimo', pickupToday: 'Šiandien', demoNote: 'Bandomoji versija', language: 'EN', shared: 'Bendras režimas', sharedInfo: 'Duomenys sinchronizuojami tarp naudotojų. Atsiskaitymas vyksta atsiimant.', signIn: 'Prisijungti', signUp: 'Sukurti paskyrą', signOut: 'Atsijungti', email: 'El. paštas', password: 'Slaptažodis', displayName: 'Vardas', phone: 'Telefonas', switchAuth: 'arba', tryDemo: 'Išbandyti demonstracinę versiją', authHint: 'Naudokite el. paštą ir slaptažodį.', checkEmail: 'Patikrinkite el. paštą ir patvirtinkite paskyrą, tada prisijunkite.', loading: 'Jungiama prie bendros duomenų bazės…', authError: 'Nepavyko prisijungti. Patikrinkite duomenis ir bandykite dar kartą.', backendError: 'Nepavyko įkelti duomenų. Patikrinkite Supabase konfigūraciją ir SQL schemą.'
  },
  en: {
    discover: 'Discover', orders: 'My orders', supplier: 'Supplier space', admin: 'Admin', community: 'COMMUNITY', workspace: 'WORKSPACE', impactTitle: 'Good things stay local', impactText: 'Each order helps neighbors save and cuts food waste.', saved: 'order value', location: 'Vilnius', demo: 'Demo mode', topCrumb: 'My neighborhood', hello: 'Welcome back', helloBuyer: 'What can we find today?', homeSub: 'Good deals just around the corner.', heroTag: 'BUY TOGETHER, PAY LESS', heroTitle: 'Good finds. Better prices.', heroText: 'Join a group order with neighbors or rescue today’s surplus food.', explore: 'Explore offers', sectionOffers: 'Near you', all: 'All offers', group: 'Group buys', surplus: 'Rescue food', nearby: 'Showing offers in', neighborhood: 'Neighborhood', available: 'available', joined: 'already joined', closingToday: 'Closes today', details: 'View details', join: 'Join order', per: 'per', collected: 'Collected', min: 'min.', bag: 'bundle', empty: 'No offers here yet', emptyText: 'Try another neighborhood or check back soon.', ordersTitle: 'My orders', ordersSub: 'Your joined group orders and pickup details.', noOrders: 'No orders yet', noOrdersText: 'Browse nearby offers and join your first group order.', browse: 'Find offers', total: 'Total', pickupCode: 'Pickup code', cancel: 'Cancel', reserved: 'Reserved', ready: 'Ready for pickup', orderDone: 'Completed', cancelled: 'Cancelled', supplierTitle: 'Supplier space', supplierSub: 'Manage offers and prepare for pickups.', newOffer: 'New offer', listings: 'My offers', activeOrders: 'Active offers', reservedUnits: 'Units reserved', awaiting: 'Awaiting approval', markReady: 'Mark ready', noListings: 'No offers yet', addFirst: 'Create your first offer using the form on the right.', createOffer: 'Create offer', offerType: 'Offer type', groupBuy: 'Group buy', surprise: 'Surplus · rescue food', title: 'Title', titlePlaceholder: 'e.g. rice, 10 kg', description: 'Description', price: 'Price (€)', unit: 'Unit', quantity: 'Quantity', minimum: 'Minimum quantity', pickupAddress: 'Pickup address', pickupTime: 'Pickup time', publish: 'Submit for review', formNote: 'New offers are reviewed by the app administrator first.', adminTitle: 'Offer management', adminSub: 'Review supplier offers and manage the pilot.', review: 'Pending review', suppliers: 'Suppliers', approvedOffers: 'Active offers', approve: 'Approve', reject: 'Reject', noPending: 'Nothing to review', allClear: 'New supplier offers will appear here.', localOnly: 'Data is stored on this device only. This is not a public, shared service.', roleBuyer: 'Buyer · Rūta', roleSupplier: 'Supplier · Mantas', roleAdmin: 'Administrator', detail: 'Offer details', pickup: 'Pickup', quantityLabel: 'Quantity', addOrder: 'Join this order', groupProgress: 'Group progress', max: 'Left', minimumHit: 'Goal reached', minWait: 'Waiting for neighbors', successJoin: 'Order added. Pickup code: ', successCancel: 'Order cancelled.', successApprove: 'Offer approved.', successReject: 'Offer rejected.', successReady: 'Offer marked ready for pickup.', successOffer: 'Offer submitted for admin review.', unavailable: 'This offer can no longer be reserved.', notEnough: 'There is not enough stock for that quantity.', required: 'Please complete all required fields.', close: 'Close', statusOpen: 'Open', statusMinimum: 'Goal reached', statusPending: 'Pending approval', pickupToday: 'Today', demoNote: 'Demo version', language: 'LT', shared: 'Shared mode', sharedInfo: 'Data syncs across users. Payment happens at pickup.', signIn: 'Sign in', signUp: 'Create account', signOut: 'Sign out', email: 'Email', password: 'Password', displayName: 'Name', phone: 'Phone', switchAuth: 'or', tryDemo: 'Try the local demo', authHint: 'Use your email and password.', checkEmail: 'Check your email to confirm your account, then sign in.', loading: 'Connecting to shared data…', authError: 'Could not sign in. Check your details and try again.', backendError: 'Could not load data. Check Supabase config and schema.'
  }
};
words.lt.deadline = 'Užsakymo terminas';
words.en.deadline = 'Order deadline';
words.lt.retry = 'Bandyti dar kartą';
words.en.retry = 'Try again';
words.lt.orderUnavailable = 'Pasiūlymo informacija nepasiekiama';
words.en.orderUnavailable = 'Offer details are unavailable';
words.lt.cancelUnavailable = 'Šio užsakymo atšaukti nebegalima.';
words.en.cancelUnavailable = 'This order can no longer be cancelled.';
words.lt.markCollected = 'Pažymėti atsiimtą';
words.en.markCollected = 'Mark collected';
words.lt.requestTimeout = 'Užklausa užtruko per ilgai. Bandykite dar kartą.';
words.en.requestTimeout = 'The request took too long. Please try again.';
words.lt.loadMore = 'Įkelti daugiau';
words.en.loadMore = 'Load more';
words.lt.loadingMore = 'Įkeliama…';
words.en.loadingMore = 'Loading…';
words.lt.successCompleted = 'Užsakymas pažymėtas kaip atsiimtas.';
words.en.successCompleted = 'Order marked as collected.';
words.lt.recoverTitle = 'Atkurti slaptažodį';
words.en.recoverTitle = 'Reset your password';
words.lt.recoverHint = 'Įveskite paskyros el. paštą ir atsiųsime slaptažodžio keitimo nuorodą.';
words.en.recoverHint = 'Enter your account email and we will send a password reset link.';
words.lt.forgotPassword = 'Pamiršote slaptažodį?';
words.en.forgotPassword = 'Forgot password?';
words.lt.sendReset = 'Siųsti nuorodą';
words.en.sendReset = 'Send reset link';
words.lt.recoverySent = 'Jei šis el. paštas susietas su paskyra, netrukus gausite slaptažodžio keitimo nuorodą.';
words.en.recoverySent = 'If an account uses this email, a password reset link will arrive shortly.';
words.lt.updatePassword = 'Nustatyti naują slaptažodį';
words.en.updatePassword = 'Set a new password';
words.lt.updatePasswordHint = 'Pasirinkite naują, bent 8 simbolių slaptažodį.';
words.en.updatePasswordHint = 'Choose a new password with at least 8 characters.';
words.lt.newPassword = 'Naujas slaptažodis';
words.en.newPassword = 'New password';
words.lt.confirmPassword = 'Pakartokite slaptažodį';
words.en.confirmPassword = 'Confirm password';
words.lt.savePassword = 'Išsaugoti slaptažodį';
words.en.savePassword = 'Save password';
words.lt.passwordMismatch = 'Slaptažodžiai nesutampa.';
words.en.passwordMismatch = 'The passwords do not match.';
words.lt.passwordTooShort = 'Slaptažodyje turi būti bent 8 simboliai.';
words.en.passwordTooShort = 'The password must contain at least 8 characters.';
words.lt.passwordUpdated = 'Slaptažodis pakeistas. Prisijunkite su naujuoju slaptažodžiu.';
words.en.passwordUpdated = 'Password updated. Sign in with your new password.';
words.lt.backToSignIn = 'Grįžti į prisijungimą';
words.en.backToSignIn = 'Back to sign in';
words.lt.exportData = 'Atsisiųsti duomenis';
words.en.exportData = 'Export my data';
words.lt.exportDone = 'Paskyros duomenys atsisiųsti.';
words.en.exportDone = 'Account data downloaded.';
words.lt.exportError = 'Nepavyko atsisiųsti paskyros duomenų.';
words.en.exportError = 'Could not export account data.';
words.lt.accountMenu = 'Paskyros meniu';
words.en.accountMenu = 'Account menu';
words.lt.deleteAccount = 'Ištrinti paskyrą';
words.en.deleteAccount = 'Delete account';
words.lt.deleteAccountConfirm = 'Ištrinsime prisijungimą ir profilio duomenis. Liks ribota užsakymų istorija: kiekiai, sumos, datos ir būsenos. Pašalinsime senus atsiėmimo kodus. Tiekėjo pasiūlymus uždarysime ir pašalinsime jo tekstus, adresus bei atsiėmimo informaciją. Pirmiausia užbaikite arba atšaukite aktyvius užsakymus. Tęsti?';
words.en.deleteAccountConfirm = 'This removes your sign-in and profile details. Limited order history remains: quantities, amounts, dates and statuses. Old pickup codes are removed. Supplier listings are closed and their text, addresses and pickup instructions are removed. Resolve active orders first. Continue?';
words.lt.accountDeleted = 'Paskyra ir atsiėmimo duomenys pašalinti. Išsaugota ribota užsakymų istorija.';
words.en.accountDeleted = 'Your account and affected pickup details were removed. Limited order history remains.';
words.lt.deletingAccount = 'Trinama…';
words.en.deletingAccount = 'Deleting…';
words.lt.deleteUnconfirmed = 'Nepavyko patvirtinti, ar paskyra ištrinta. Patikrinkite paskyros būseną arba bandykite ištrinti dar kartą.';
words.en.deleteUnconfirmed = 'We could not confirm whether deletion finished. Check your account status or retry deletion.';
words.lt.deleteBusy = 'Paskyra arba užsakymai šiuo metu atnaujinami. Netrukus bandykite dar kartą.';
words.en.deleteBusy = 'Your account or orders are being updated. Please try again shortly.';
words.lt.removedListing = 'Pašalintas pasiūlymas';
words.en.removedListing = 'Removed listing';
words.lt.formerSupplier = 'Buvęs tiekėjas';
words.en.formerSupplier = 'Former supplier';
words.lt.pickupRemoved = 'Atsiėmimo duomenys pašalinti';
words.en.pickupRemoved = 'Pickup details removed';
words.lt.deleteActiveOrders = 'Prieš ištrinant paskyrą užbaikite arba atšaukite aktyvius užsakymus.';
words.en.deleteActiveOrders = 'Complete or cancel active orders before deleting the account.';
words.lt.deleteSupplierOrders = 'Tiekėjo užsakymai dar nebaigti. Pirmiausia juos užbaikite.';
words.en.deleteSupplierOrders = 'Some supplier orders are still active. Complete them first.';
words.lt.deleteLastAdmin = 'Paskutinės administratoriaus paskyros ištrinti negalima. Pirmiausia paskirkite kitą administratorių.';
words.en.deleteLastAdmin = 'The last admin account cannot be deleted. Assign another admin first.';
words.lt.deleteError = 'Nepavyko ištrinti paskyros. Bandykite dar kartą.';
words.en.deleteError = 'Could not delete the account. Please try again.';
words.lt.rateLimitWait = 'Pasiekėte trumpalaikį veiksmų limitą. Palaukite ir bandykite vėliau.';
words.en.rateLimitWait = 'You have reached the short-term action limit. Wait a bit and try again.';

const offerHoursLeft = (offer) => {
  const deadlineAt = Date.parse(offer?.deadline || '');
  return Number.isFinite(deadlineAt) ? Math.max(0, (deadlineAt - Date.now()) / 3600000) : 0;
};

const normalizeOfferDeadline = (offer, now = Date.now()) => {
  const parsedDeadline = Date.parse(offer?.deadline || '');
  const deadlineAt = Number.isFinite(parsedDeadline)
    ? parsedDeadline
    : now + Math.max(0, Number(offer?.hoursLeft) || 0) * 3600000;
  const deadline = new Date(deadlineAt).toISOString();
  return { ...offer, deadline, hoursLeft: Math.max(0, (deadlineAt - now) / 3600000) };
};

const seedState = () => ({
  version: 1,
  offers: initialOffers.map((offer) => normalizeOfferDeadline(structuredClone(offer))),
  orders: [],
  currentRole: 'buyer',
  neighborhood: 'Naujamiestis',
  lang: 'lt',
  view: 'discover',
  category: 'all'
});

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.version === 1 && Array.isArray(saved.offers) && Array.isArray(saved.orders)) {
      return { ...seedState(), ...saved, offers: saved.offers.map((offer) => normalizeOfferDeadline(offer)) };
    }
  } catch { /* start with demo data */ }
  return seedState();
}

let state = readState();
let modalOfferId = null;
let modalQuantity = 1;
let reservationBusy = false;
let deletionBusy = false;
let deletionMessage = '';
let modalOpener = null;
let toastTimer;
let remoteProfile = null;
let remoteNeighborhoods = [];
let remoteLoading = false;
let remoteError = '';
let remoteOffersOffset = 0;
let remoteOrdersOffset = 0;
let remoteOffersHaveMore = false;
let remoteOrdersHaveMore = false;
let remotePageLoading = '';
const REMOTE_PAGE_SIZE = 50;
let authMessage = '';
let authMode = 'signin';
let authBusy = false;
let localDemoOverride = false;
let authSession = null;
try {
  authSession = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  if (!authSession) {
    authSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (authSession) sessionStorage.setItem(SESSION_KEY, JSON.stringify(authSession));
    localStorage.removeItem(SESSION_KEY);
  }
} catch { authSession = null; }
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');
const t = (key) => words[state.lang]?.[key] ?? words.lt[key] ?? key;
const isSharedMode = () => REMOTE_CONFIGURED && !localDemoOverride;
function persistAuthSession(session) {
  authSession = session;
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
}
function initializeRecoveryLink() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  if (params.get('type') !== 'recovery' || !params.get('access_token')) return false;
  const expiresIn = Number(params.get('expires_in')) || 3600;
  persistAuthSession({
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    token_type: params.get('token_type') || 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: {}
  });
  authMode = 'update-password';
  history.replaceState(null, document.title, `${location.pathname}${location.search}`);
  return true;
}
const user = () => remoteProfile ? { id: remoteProfile.id, name: remoteProfile.display_name, initials: (remoteProfile.display_name || 'KU').split(/\s+/).slice(0,2).map(x => x[0]?.toUpperCase() || '').join(''), role: remoteProfile.role, supplierId: remoteProfile.supplierId || null } : (demoUsers[state.currentRole] ?? demoUsers.buyer);
const save = () => {
  if (isSharedMode()) localStorage.setItem(`${STORAGE_KEY}-prefs`, JSON.stringify({ lang: state.lang, view: state.view, category: state.category, neighborhood: state.neighborhood }));
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};
const money = (cents) => new Intl.NumberFormat(state.lang === 'lt' ? 'lt-LT' : 'en-IE', { style: 'currency', currency: 'EUR' }).format((cents || 0) / 100);
const safe = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const PENDING_RESERVATIONS_KEY = 'kartu-pending-reservations-v1';
function newUuid() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  if (window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return [...bytes].map((byte, index) => `${[4, 6, 8, 10].includes(index) ? '-' : ''}${byte.toString(16).padStart(2, '0')}`).join('');
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const random = Math.floor(Math.random() * 16);
    return (c === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}
function reservationKeyFor(offerId, quantity) {
  const requestId = `${user().id}:${offerId}:${quantity}`;
  let requests = {};
  try { requests = JSON.parse(localStorage.getItem(PENDING_RESERVATIONS_KEY) || '{}'); } catch { requests = {}; }
  if (requests[requestId]) return requests[requestId];
  const key = newUuid();
  requests[requestId] = key;
  const requestIds = Object.keys(requests);
  while (requestIds.length > 20) delete requests[requestIds.shift()];
  localStorage.setItem(PENDING_RESERVATIONS_KEY, JSON.stringify(requests));
  return key;
}
function clearReservationKey(offerId, quantity, key) {
  const requestId = `${user().id}:${offerId}:${quantity}`;
  try {
    const requests = JSON.parse(localStorage.getItem(PENDING_RESERVATIONS_KEY) || '{}');
    if (requests[requestId] === key) {
      delete requests[requestId];
      localStorage.setItem(PENDING_RESERVATIONS_KEY, JSON.stringify(requests));
    }
  } catch { /* Keep the server-side idempotency guarantee if local storage is unavailable. */ }
}
const title = (offer) => offer.redacted ? t('removedListing') : state.lang === 'en' ? offer.nameEn || offer.name : offer.name;
const description = (offer) => state.lang === 'en' ? offer.descriptionEn || offer.description : offer.description;
const activeOrders = () => state.orders.filter((o) => o.buyerId === user().id && o.status !== 'cancelled');
const getOffer = (id) => state.offers.find((o) => o.id === id);
const currentOffers = () => state.offers.filter((o) => o.neighborhood === state.neighborhood && ['open', 'minimum_reached'].includes(o.status) && offerHoursLeft(o) > 0 && o.stock - o.reservedQty > 0);

async function supabase(path, options = {}, allowRefresh = true) {
  const base = String(SUPABASE_CONFIG.supabaseUrl || '').replace(/\/$/, '');
  const headers = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authSession?.access_token && !path.startsWith('/auth/v1/token') && !path.startsWith('/auth/v1/signup')) headers.Authorization = `Bearer ${authSession.access_token}`;
  else if (SUPABASE_CONFIG.supabaseAnonKey && !SUPABASE_CONFIG.supabasePublishableKey) headers.Authorization = `Bearer ${SUPABASE_CONFIG.supabaseAnonKey}`;
  else delete headers.Authorization;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), 15000) : null;
  let response;
  try {
    response = await fetch(`${base}${path}`, { ...options, headers, ...(controller ? { signal: controller.signal } : {}) });
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(t('requestTimeout')); timeoutError.code = 'REQUEST_TIMEOUT'; throw timeoutError;
    }
    throw error;
  } finally {
    if (timeout !== null) clearTimeout(timeout);
  }
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok && response.status === 401 && allowRefresh && authSession?.refresh_token && !path.startsWith('/auth/v1/')) {
    const refreshed = await supabase('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: authSession.refresh_token }) }, false);
    persistAuthSession(refreshed);
    return supabase(path, options, false);
  }
  if (!response.ok) {
    const errorMessage = String(data?.message || data?.msg || data?.error_description || data?.hint || `Request failed (${response.status})`);
    const error = new Error(errorMessage.startsWith('Too many requests. Please wait and try again') ? t('rateLimitWait') : errorMessage);
    error.code = data?.code || ''; error.status = response.status;
    throw error;
  }
  return data;
}

function mapRemoteOffer(o, profile, supplierId) {
  return {
    id: o.id, type: o.offer_type, name: o.title, nameEn: o.title, description: o.description, descriptionEn: o.description,
    supplierId: o.supplier_id, supplier: o.suppliers?.public_name || '', ownerId: supplierId === o.supplier_id ? profile.id : null,
    emoji: o.offer_type === 'surplus' ? '🥖' : '📦', tone: o.offer_type === 'surplus' ? '#f4e0c8' : '#e6e9d8',
    priceCents: o.price_cents, unit: o.unit, stock: o.stock, minimum: o.minimum, reservedQty: o.reserved_quantity,
    neighborhood: o.neighborhoods?.name || '', neighborhoodId: o.neighborhood_id, address: o.pickup_address, pickup: o.pickup_details,
    deadline: o.deadline, hoursLeft: Math.max(0, (Date.parse(o.deadline) - Date.now()) / 3600000), status: o.status, redacted: Boolean(o.redacted_at),
    tag: o.offer_type === 'surplus' ? 'Mažiau atliekų' : 'Perkame kartu', distance: ''
  };
}

async function loadRemoteData() {
  if (remoteLoading) return;
  const requestedAccountId = authSession?.user?.id;
  remoteLoading = true; remoteError = ''; render();
  try {
    if (authSession?.expires_at && authSession.expires_at * 1000 < Date.now() + 30000 && authSession.refresh_token) {
      const refreshed = await supabase('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: authSession.refresh_token }) });
      if (authSession?.user?.id !== requestedAccountId) return;
      persistAuthSession(refreshed);
    }
    if (!authSession?.access_token) { remoteProfile = null; return; }
    const me = await supabase(`/rest/v1/profiles?select=id,display_name,phone,role,neighborhood_id,neighborhoods(name)&id=eq.${encodeURIComponent(authSession.user.id)}`);
    const nextProfile = me?.[0] || null;
    if (!nextProfile) throw new Error('Your profile is not available. Run the database schema from supabase/schema.sql.');
    const [areas, offers, reservations, suppliers] = await Promise.all([
      supabase('/rest/v1/neighborhoods?select=id,slug,name,city,active&active=eq.true&order=name.asc'),
      supabase(`/rest/v1/offers?select=*,suppliers(id,public_name),neighborhoods(id,name,slug)&order=created_at.desc,id.desc&limit=${REMOTE_PAGE_SIZE}&offset=0`),
      supabase(`/rest/v1/reservations?select=*&order=created_at.desc,id.desc&limit=${REMOTE_PAGE_SIZE}&offset=0`),
      nextProfile.role === 'supplier' ? supabase(`/rest/v1/suppliers?select=id,public_name,approved&user_id=eq.${encodeURIComponent(nextProfile.id)}`) : Promise.resolve([])
    ]);
    const nextNeighborhoods = areas || [];
    const nextSupplierId = suppliers?.[0]?.id || null;
    const nextOffers = (offers || []).map((o) => mapRemoteOffer(o, nextProfile, nextSupplierId));
    const nextOrders = (reservations || []).map((r) => ({ id: r.id, offerId: r.offer_id, buyerId: r.buyer_id, quantity: r.quantity, totalCents: r.total_cents, code: r.pickup_code, status: r.status, createdAt: r.created_at }));
    const savedPrefs = (() => { try { return JSON.parse(localStorage.getItem(`${STORAGE_KEY}-prefs`) || '{}'); } catch { return {}; } })();
    let nextNeighborhood = savedPrefs.neighborhood || nextProfile.neighborhoods?.name || 'Naujamiestis';
    if (!nextNeighborhoods.some(n => n.name === nextNeighborhood)) nextNeighborhood = nextNeighborhoods[0]?.name || 'Naujamiestis';

    // Commit the shared snapshot only after every required request succeeds.
    if (authSession?.user?.id !== requestedAccountId) return;
    remoteNeighborhoods = nextNeighborhoods;
    remoteProfile = { ...nextProfile, supplierId: nextSupplierId };
    remoteOffersOffset = nextOffers.length;
    remoteOrdersOffset = nextOrders.length;
    remoteOffersHaveMore = nextOffers.length === REMOTE_PAGE_SIZE;
    remoteOrdersHaveMore = nextOrders.length === REMOTE_PAGE_SIZE;
    state = {
      ...state,
      offers: nextOffers,
      orders: nextOrders,
      lang: savedPrefs.lang || state.lang,
      view: savedPrefs.view || 'discover',
      category: savedPrefs.category || 'all',
      neighborhood: nextNeighborhood
    };
  } catch (error) {
    if (authSession?.user?.id !== requestedAccountId) return;
    remoteError = error.message || t('backendError');
    if (/invalid|expired|jwt/i.test(remoteError)) { persistAuthSession(null); remoteProfile = null; }
  } finally { remoteLoading = false; render(); }
}

async function loadMoreRemote(kind) {
  if (!isSharedMode() || remoteLoading || remotePageLoading) return;
  if (kind === 'offers' && !remoteOffersHaveMore) return;
  if (kind === 'orders' && !remoteOrdersHaveMore) return;
  remotePageLoading = kind;
  const requestedAccountId = remoteProfile?.id;
  render();
  try {
    if (kind === 'offers') {
      const page = await supabase(`/rest/v1/offers?select=*,suppliers(id,public_name),neighborhoods(id,name,slug)&order=created_at.desc,id.desc&limit=${REMOTE_PAGE_SIZE}&offset=${remoteOffersOffset}`);
      if (!authSession?.access_token || remoteProfile?.id !== requestedAccountId) return;
      const mapped = (page || []).map((o) => mapRemoteOffer(o, remoteProfile, remoteProfile?.supplierId));
      const seen = new Set(state.offers.map((offer) => offer.id));
      state.offers = [...state.offers, ...mapped.filter((offer) => !seen.has(offer.id))];
      remoteOffersOffset += (page || []).length;
      remoteOffersHaveMore = (page || []).length === REMOTE_PAGE_SIZE;
    } else {
      const page = await supabase(`/rest/v1/reservations?select=*&order=created_at.desc,id.desc&limit=${REMOTE_PAGE_SIZE}&offset=${remoteOrdersOffset}`);
      if (!authSession?.access_token || remoteProfile?.id !== requestedAccountId) return;
      const mapped = (page || []).map((r) => ({ id: r.id, offerId: r.offer_id, buyerId: r.buyer_id, quantity: r.quantity, totalCents: r.total_cents, code: r.pickup_code, status: r.status, createdAt: r.created_at }));
      const seen = new Set(state.orders.map((order) => order.id));
      state.orders = [...state.orders, ...mapped.filter((order) => !seen.has(order.id))];
      remoteOrdersOffset += (page || []).length;
      remoteOrdersHaveMore = (page || []).length === REMOTE_PAGE_SIZE;
    }
  } catch (error) {
    showToast(error.message || t('backendError'));
  } finally {
    remotePageLoading = '';
    render();
  }
}

async function fetchAllPages(path) {
  const rows = [];
  const pageSize = 500;
  const maxRows = 50000;
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const limit = Math.min(pageSize, maxRows - offset);
    const page = await supabase(`${path}&limit=${limit}&offset=${offset}`);
    rows.push(...(page || []));
    if ((page || []).length < limit) return rows;
  }
  const extra = await supabase(`${path}&limit=1&offset=${maxRows}`);
  if (!(extra || []).length) return rows;
  throw new Error('Export is larger than the supported 50,000-row limit. Contact the administrator for a complete export.');
}

async function exportAccountData() {
  if (!isSharedMode() || !remoteProfile) return;
  try {
    const [profiles, reservations, offers, suppliers] = await Promise.all([
      supabase(`/rest/v1/profiles?select=id,display_name,phone,role,neighborhood_id,neighborhoods(name)&id=eq.${encodeURIComponent(remoteProfile.id)}`),
      fetchAllPages('/rest/v1/reservations?select=*&order=created_at.asc,id.asc'),
      remoteProfile.supplierId ? fetchAllPages(`/rest/v1/offers?select=*&supplier_id=eq.${encodeURIComponent(remoteProfile.supplierId)}&order=created_at.asc,id.asc`) : Promise.resolve([]),
      remoteProfile.supplierId ? supabase(`/rest/v1/suppliers?select=id,public_name,about,approved,created_at&id=eq.${encodeURIComponent(remoteProfile.supplierId)}&user_id=eq.${encodeURIComponent(remoteProfile.id)}`) : Promise.resolve([])
    ]);
    const payload = {
      exported_at: new Date().toISOString(),
      account: { email: authSession?.user?.email || null, profile: profiles?.[0] || null },
      supplier_profile: suppliers?.[0] || null,
      reservations,
      supplier_offers: offers
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `kartu-account-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast(t('exportDone'));
  } catch (error) {
    showToast(error.message || t('exportError'));
  }
}

async function deleteAccount() {
  if (deletionBusy || !isSharedMode() || !remoteProfile || !window.confirm(t('deleteAccountConfirm'))) return;
  const accountId = remoteProfile.id;
  deletionBusy = true; deletionMessage = ''; render();
  try {
    await supabase('/rest/v1/rpc/delete_my_account', { method: 'POST', body: '{}' });
    if (authSession?.user?.id !== accountId) return;
    persistAuthSession(null);
    try {
      const requests = JSON.parse(localStorage.getItem(PENDING_RESERVATIONS_KEY) || '{}');
      for (const key of Object.keys(requests)) if (key.startsWith(`${accountId}:`)) delete requests[key];
      localStorage.setItem(PENDING_RESERVATIONS_KEY, JSON.stringify(requests));
      localStorage.removeItem(`${STORAGE_KEY}-prefs`);
    } catch { /* Account removal is committed even when browser storage is unavailable. */ }
    remoteProfile = null; remoteNeighborhoods = []; remoteError = ''; authMode = 'signin'; authMessage = t('accountDeleted');
    state = { ...seedState(), lang: state.lang }; modalOfferId = null; modalOpener = null;
    remoteOffersOffset = 0; remoteOrdersOffset = 0; remoteOffersHaveMore = false; remoteOrdersHaveMore = false;
  } catch (error) {
    const message = error.message || '';
    if (message.includes('Active reservations must')) deletionMessage = t('deleteActiveOrders');
    else if (message.includes('Supplier orders must')) deletionMessage = t('deleteSupplierOrders');
    else if (message.includes('last admin')) deletionMessage = t('deleteLastAdmin');
    else if (['55P03', '40001', '40P01'].includes(error.code)) deletionMessage = t('deleteBusy');
    else if (!error.status || error.status >= 500 || error.status === 401) deletionMessage = t('deleteUnconfirmed');
    else deletionMessage = t('deleteError');
  } finally {
    deletionBusy = false; render();
  }
}

async function boot() {
  if (REMOTE_CONFIGURED && initializeRecoveryLink()) { renderAuth(); return; }
  if (REMOTE_CONFIGURED) await loadRemoteData();
  else render();
}

function statusText(status) {
  if (status === 'ready_for_pickup') return t('ready');
  if (status === 'completed') return t('orderDone');
  if (status === 'cancelled') return t('cancelled');
  return t('reserved');
}

function render() {
  if (authMode !== 'update-password' && isSharedMode() && authSession?.access_token && (remoteLoading || remoteError || !remoteProfile)) { renderSharedStatus(); return; }
  if (isSharedMode() && !remoteProfile) { renderAuth(); return; }
  save();
  const role = user().role;
  const currentView = state.view === 'supplier' && role !== 'supplier' ? 'discover' : state.view === 'admin' && role !== 'admin' ? 'discover' : state.view;
  const labels = [
    ['discover', '⌂', t('discover')], ['orders', '▤', t('orders')],
    ...(role === 'supplier' ? [['supplier', '▧', t('supplier')]] : []),
    ...(role === 'admin' ? [['admin', '⚙', t('admin')]] : [])
  ];
  app.innerHTML = `
    <div class="app-frame">
      <aside class="sidebar">
        <a class="brand" href="#" data-action="go" data-view="discover" aria-label="Kartu home"><span class="brand-mark">k</span><span class="brand-name">kartu<span>.</span></span></a>
        <div><p class="side-label">${t('community')}</p><nav class="nav-list" aria-label="${t('community')}">${labels.slice(0,2).map((n) => navItem(n, currentView)).join('')}</nav></div>
        ${labels.length > 2 ? `<div><p class="side-label">${t('workspace')}</p><nav class="nav-list" aria-label="${t('workspace')}">${labels.slice(2).map((n) => navItem(n, currentView)).join('')}</nav></div>` : ''}
        <div class="sidebar-bottom">
          <div class="impact-card"><span class="impact-icon">🌱</span><strong>${t('impactTitle')}</strong><p>${t('impactText')}</p></div>
          <div class="side-profile"><div class="avatar">${safe(user().initials)}</div><div class="profile-copy"><strong>${safe(user().name)}</strong><span>${safe(roleLabel(role))}</span></div><button class="profile-role" data-action="cycle-role" title="Change demo user" aria-label="Change demo user">⌄</button></div>
        </div>
      </aside>
      <main class="main-column">
        <header class="topbar"><div class="crumbs"><span class="mobile-brand">kartu<span>.</span></span><span class="desktop-crumb">${t('topCrumb')} <span> / </span> <strong>${safe(state.neighborhood)}, ${t('location')}</strong></span></div>
          <div class="top-actions">
            <select class="location-select" data-change="neighborhood" aria-label="${t('neighborhood')}">
              ${(isSharedMode() ? remoteNeighborhoods.map(n => n.name) : ['Naujamiestis','Šnipiškės','Žvėrynas']).map((n) => `<option value="${safe(n)}" ${state.neighborhood === n ? 'selected' : ''}>⌖ ${safe(n)}</option>`).join('')}
            </select>
            <button class="language-btn" data-action="language" aria-label="Switch language">${t('language')}</button>
            ${isSharedMode() ? `<details class="account-menu"><summary aria-label="${t('accountMenu')}">•••</summary><div class="account-menu-popover"><button data-action="export-account">${t('exportData')}</button><button class="danger" data-action="delete-account" ${deletionBusy ? 'disabled aria-busy="true"' : ''}>${t(deletionBusy ? 'deletingAccount' : 'deleteAccount')}</button><button data-action="sign-out">${t('signOut')}</button></div></details>` : `<select class="demo-select" data-change="role" aria-label="${t('demoNote')}">
              <option value="buyer" ${role === 'buyer' ? 'selected' : ''}>👤 ${t('roleBuyer')}</option>
              <option value="supplier" ${role === 'supplier' ? 'selected' : ''}>🏪 ${t('roleSupplier')}</option>
              <option value="admin" ${role === 'admin' ? 'selected' : ''}>🛠 ${t('roleAdmin')}</option>
            </select>`}
          </div>
        </header>
        <section class="content">
          ${deletionMessage ? `<p class="auth-message" role="alert">${safe(deletionMessage)}</p>` : ''}
          ${deletionBusy ? `<p role="status">${t('deletingAccount')}</p>` : ''}
          <div class="demo-banner"><span>ⓘ</span><span><strong>${isSharedMode() ? t('shared') : t('demo')}</strong> — ${isSharedMode() ? t('sharedInfo') : t('localOnly')}</span></div>
          ${currentView === 'discover' ? renderDiscover() : currentView === 'orders' ? renderOrders() : currentView === 'supplier' ? renderSupplier() : renderAdmin()}
        </section>
        <nav class="mobile-nav" aria-label="Mobile navigation">${labels.map((n) => `<button data-action="go" data-view="${n[0]}" class="${currentView === n[0] ? 'active' : ''}"><span class="nav-icon">${n[1]}</span>${n[2]}</button>`).join('')}</nav>
      </main>
    </div>`;
  renderModal();
}

function renderAuth() {
  if (remoteLoading) {
    app.innerHTML = `<main class="auth-shell"><div class="auth-card"><div class="brand"><span class="brand-mark">k</span><span class="brand-name">kartu<span>.</span></span></div><p class="page-subtitle">${t('loading')}</p><div class="loading-dots">•••</div></div></main>`;
    return;
  }
  const recovering = authMode === 'recover';
  const updating = authMode === 'update-password';
  const heading = recovering ? t('recoverTitle') : updating ? t('updatePassword') : t(authMode === 'signin' ? 'signIn' : 'signUp');
  const hint = recovering ? t('recoverHint') : updating ? t('updatePasswordHint') : t('authHint');
  const submitLabel = recovering ? t('sendReset') : updating ? t('savePassword') : t(authMode === 'signin' ? 'signIn' : 'signUp');
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><div class="brand"><span class="brand-mark">k</span><span class="brand-name">kartu<span>.</span></span></div><p class="eyebrow">${t('shared')}</p><h1>${heading}</h1><p class="page-subtitle">${hint}</p>
    ${remoteError ? `<p class="auth-message" role="alert">${safe(remoteError)}</p>` : ''}
    ${authMessage ? `<p class="auth-message success" role="status">${safe(authMessage)}</p>` : ''}
    <form id="auth-form"><div class="form-grid">
      ${authMode === 'signup' ? `<div class="field span-2"><label for="auth-name">${t('displayName')}</label><input id="auth-name" name="display_name" autocomplete="name" required maxlength="80" /></div>` : ''}
      ${!updating ? `<div class="field span-2"><label for="auth-email">${t('email')}</label><input id="auth-email" type="email" name="email" autocomplete="email" required /></div>` : ''}
      ${authMode === 'signup' ? `<div class="field span-2"><label for="auth-phone">${t('phone')}</label><input id="auth-phone" type="tel" name="phone" autocomplete="tel" /></div>` : ''}
      ${!recovering ? `<div class="field span-2"><label for="auth-password">${updating ? t('newPassword') : t('password')}</label><input id="auth-password" type="password" name="password" autocomplete="${authMode === 'signin' ? 'current-password' : 'new-password'}" required minlength="8" /></div>` : ''}
      ${updating ? `<div class="field span-2"><label for="auth-confirm-password">${t('confirmPassword')}</label><input id="auth-confirm-password" type="password" name="confirm_password" autocomplete="new-password" required minlength="8" /></div>` : ''}
      </div><p class="form-message" id="auth-form-message" role="alert"></p><button class="primary-btn" type="submit" ${authBusy ? 'disabled' : ''}>${authBusy ? '…' : submitLabel}</button></form>
      ${authMode === 'signin' ? `<p class="auth-switch"><button class="text-btn" data-action="auth-mode" data-mode="recover">${t('forgotPassword')}</button></p>` : ''}
      ${authMode === 'signin' || authMode === 'signup' ? `<p class="auth-switch">${t('switchAuth')} <button class="text-btn" data-action="auth-mode" data-mode="${authMode === 'signin' ? 'signup' : 'signin'}">${t(authMode === 'signin' ? 'signUp' : 'signIn')}</button></p>` : `<p class="auth-switch"><button class="text-btn" data-action="auth-mode" data-mode="signin">${t('backToSignIn')}</button></p>`}
      ${authMode === 'signin' || authMode === 'signup' ? `<div class="auth-divider"><span>· · ·</span></div><button class="secondary-btn demo-link" data-action="use-demo">${t('tryDemo')}</button>` : ''}
    </section></main>`;
}

function renderSharedStatus() {
  const loading = remoteLoading;
  const message = loading ? t('loading') : remoteError || t('backendError');
  app.innerHTML = `<main class="auth-shell"><section class="auth-card"><div class="brand"><span class="brand-mark">k</span><span class="brand-name">kartu<span>.</span></span></div><p class="eyebrow">${t('shared')}</p><h1>${loading ? t('loading') : t('backendError')}</h1><p class="auth-message" role="${loading ? 'status' : 'alert'}">${safe(message)}</p>
    ${loading ? '<div class="loading-dots">•••</div>' : `<button class="primary-btn" data-action="retry-remote">${t('retry')}</button><p class="auth-switch"><button class="text-btn" data-action="use-demo">${t('tryDemo')}</button><button class="text-btn" data-action="sign-out">${t('signOut')}</button></p>`}
  </section></main>`;
}

function navItem(item, currentView) {
  return `<button class="nav-btn ${currentView === item[0] ? 'active' : ''}" data-action="go" data-view="${item[0]}"><span class="nav-icon">${item[1]}</span>${item[2]}${item[0] === 'orders' && activeOrders().length ? `<span class="nav-count">${activeOrders().length}</span>` : ''}</button>`;
}

function renderLoadMore(kind, hasMore) {
  if (!isSharedMode() || !hasMore) return '';
  const loading = remotePageLoading === kind;
  return `<div class="load-more"><button class="secondary-btn" data-action="load-more-${kind}" ${loading ? 'disabled' : ''}>${loading ? t('loadingMore') : t('loadMore')}</button></div>`;
}

function roleLabel(role) { return role === 'supplier' ? t('roleSupplier') : role === 'admin' ? t('roleAdmin') : t('roleBuyer'); }

function renderDiscover() {
  const offers = currentOffers().filter((o) => state.category === 'all' || o.type === state.category);
  const saved = activeOrders().reduce((sum, o) => sum + o.totalCents, 0);
  return `<div class="page-heading fade-up"><div><p class="eyebrow">${t('hello')}</p><h1>${t('helloBuyer')}</h1><p class="page-subtitle">${t('homeSub')}</p></div><button class="secondary-btn" data-action="go" data-view="orders">${t('orders')} · ${activeOrders().length}</button></div>
    <section class="hero fade-up"><div class="hero-copy"><div class="hero-kicker">${t('heroTag')}</div><h2>${t('heroTitle')}</h2><p>${t('heroText')}</p><button class="primary-btn" data-action="scroll-offers">${t('explore')} <span aria-hidden="true">→</span></button></div><div class="hero-art" aria-hidden="true"><div class="hero-produce">🥬</div><div class="hero-produce two">🍞</div></div></section>
    <div class="inline-stats"><div class="stat-chip"><strong>${activeOrders().length}</strong> ${t('orders').toLowerCase()}</div><div class="stat-chip"><strong>${money(saved)}</strong> ${t('saved')}</div><div class="stat-chip">⌖ ${t('nearby')} <strong>${safe(state.neighborhood)}</strong></div></div>
    <section id="offers-section"><div class="offer-toolbar"><h2 class="section-title">${t('sectionOffers')}</h2><div class="filter-row" role="group" aria-label="Offer filter">
      ${[['all',t('all')],['group_buy',t('group')],['surplus',t('surplus')]].map(([value,label]) => `<button class="filter-btn ${state.category === value ? 'active' : ''}" data-action="category" data-category="${value}">${label}</button>`).join('')}
      </div></div>
      <div class="offer-grid">${offers.length ? offers.map(renderOfferCard).join('') : `<div class="empty-state"><div class="empty-icon">🧺</div><h3>${t('empty')}</h3><p>${t('emptyText')}</p></div>`}</div>${renderLoadMore('offers', remoteOffersHaveMore)}
    </section>`;
}

function renderOfferCard(o) {
  const left = Math.max(0, o.stock - o.reservedQty);
  const hoursLeft = offerHoursLeft(o);
  const group = o.type === 'group_buy';
  const progress = group ? Math.min(100, Math.round((o.reservedQty / Math.max(1,o.minimum)) * 100)) : 0;
  const reached = group && o.reservedQty >= o.minimum;
  const label = o.type === 'surplus' ? t('surplus') : t('group');
  return `<article class="offer-card fade-up"><div class="offer-image" style="--tone:${safe(o.tone)}"><span class="offer-label">${safe(label)}</span><span class="food-emoji" aria-hidden="true">${safe(o.emoji)}</span><span class="offer-distance">⌖ ${safe(o.distance)}</span></div>
    <div class="offer-body"><div class="supplier-name">${safe(o.supplier)}</div><h3>${safe(title(o))}</h3><div class="offer-meta"><span>${left} ${t('available')} · ${safe(o.unit)}</span><span>${hoursLeft <= 6 ? '⏱ ' + t('closingToday') : '⏱ ' + t('max') + ' ' + Math.floor(hoursLeft/24) + ' d.'}</span></div>
      ${group ? `<div class="progress-wrap"><div class="progress-copy"><span>${t('collected')} <strong>${o.reservedQty}/${o.minimum}</strong> ${t('min')}</span><strong>${reached ? t('minimumHit') : `${Math.min(100,progress)}%`}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100,progress)}%"></div></div></div>` : '<div class="progress-wrap" aria-hidden="true"></div>'}
      <div class="offer-bottom"><div class="price">${money(o.priceCents)} <small>${t('per')} ${safe(o.unit)}</small></div><button class="primary-btn" data-action="open-offer" data-id="${safe(o.id)}">${t('details')}</button></div>
    </div></article>`;
}

function renderOrders() {
  const orders = [...activeOrders()].reverse();
  return `<div class="page-heading"><div><p class="eyebrow">${t('community')}</p><h1>${t('ordersTitle')}</h1><p class="page-subtitle">${t('ordersSub')}</p></div><button class="primary-btn" data-action="go" data-view="discover">${t('browse')} →</button></div>
    <div class="orders-list">${orders.length ? orders.map((order) => {
      const offer = getOffer(order.offerId);
      const pickupCode = order.code ? `<p class="order-sub">${t('pickupCode')}: <span class="pickup-code">${safe(order.code)}</span></p>` : '';
      const status = `<span class="status-pill ${order.status === 'ready_for_pickup' ? 'ready' : ''}">${statusText(order.status)}</span>`;
      if (!offer) {
        return `<article class="order-row"><div class="order-main"><div class="order-emoji" aria-hidden="true">🧾</div><div><h3 class="order-title">${t('orderUnavailable')}</h3><p class="order-sub">${order.quantity} × ${money(order.totalCents)}</p>${pickupCode}</div></div><div class="order-side"><strong>${money(order.totalCents)}</strong>${status}</div></article>`;
      }
      const canCancel = order.status === 'reserved' && ['open', 'minimum_reached'].includes(offer.status) && offerHoursLeft(offer) > 0;
      return `<article class="order-row"><div class="order-main"><div class="order-emoji" style="background:${safe(offer.tone)}">${safe(offer.emoji)}</div><div><h3 class="order-title">${safe(title(offer))}</h3><p class="order-sub">${offer.redacted ? t('formerSupplier') : safe(offer.supplier)} · ${order.quantity} × ${money(offer.priceCents)}${offer.pickup ? ` · ${safe(offer.pickup)}` : ''}${offer.redacted ? ` · ${t('pickupRemoved')}` : ''}</p>${pickupCode}</div></div><div class="order-side"><strong>${money(order.totalCents)}</strong>${status}${canCancel ? `<br><button class="cancel-btn" data-action="cancel-order" data-id="${safe(order.id)}">${t('cancel')}</button>` : ''}</div></article>`;
    }).join('') : `<div class="empty-state"><div class="empty-icon">🛍️</div><h3>${t('noOrders')}</h3><p>${t('noOrdersText')}</p><br><button class="primary-btn" data-action="go" data-view="discover">${t('browse')}</button></div>`}</div>${renderLoadMore('orders', remoteOrdersHaveMore)}`;
}

function renderSupplier() {
  const supplierId = user().supplierId;
  const offers = state.offers.filter((o) => o.ownerId === user().id || o.supplierId === supplierId);
  const activeOfferCount = offers.filter((o) => ['open', 'minimum_reached'].includes(o.status)).length;
  const reserved = offers.reduce((sum, o) => sum + o.reservedQty, 0);
  return `<div class="page-heading"><div><p class="eyebrow">${t('workspace')}</p><h1>${t('supplierTitle')}</h1><p class="page-subtitle">${t('supplierSub')}</p></div></div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>${t('listings')}</h2><p>${safe(user().name)}</p></div><span class="status-pill">${activeOfferCount} ${t('activeOrders').toLowerCase()}</span></div>
      <div class="quick-stat-row"><div class="quick-stat"><span>${t('activeOrders')}</span><strong>${activeOfferCount}</strong></div><div class="quick-stat"><span>${t('reservedUnits')}</span><strong>${reserved}</strong></div><div class="quick-stat"><span>${t('awaiting')}</span><strong>${offers.filter(o => o.status === 'pending_approval').length}</strong></div></div>
      ${offers.length ? offers.map((o) => `<div class="listing-block"><div class="my-listing"><div class="mini-thumb" style="background:${safe(o.tone)}">${safe(o.emoji)}</div><div><strong>${safe(title(o))}</strong><span>${o.reservedQty}/${o.stock} ${t('reserved').toLowerCase()} · ${money(o.priceCents)}</span></div><div>${o.status === 'pending_approval' ? `<span class="status-pill pending">${t('statusPending')}</span>` : o.status === 'ready_for_pickup' ? `<span class="status-pill ready">${t('ready')}</span>` : `<button class="secondary-btn" data-action="supplier-ready" data-id="${safe(o.id)}">${t('markReady')}</button>`}</div></div>${renderSupplierReservations(o.id)}</div>`).join('') : `<div class="empty-state"><div class="empty-icon">📦</div><h3>${t('noListings')}</h3><p>${t('addFirst')}</p></div>`}${renderLoadMore('offers', remoteOffersHaveMore)}
    </section><aside class="panel"><div class="panel-head"><div><h2>${t('createOffer')}</h2><p>${t('formNote')}</p></div></div>${renderOfferForm()}</aside></div>`;
}

function renderSupplierReservations(offerId) {
  const orders = state.orders.filter((o) => o.offerId === offerId && o.status !== 'cancelled');
  if (!orders.length) return '';
  return `<details class="supplier-orders"><summary>${orders.length} ${t('orders').toLowerCase()}</summary>${orders.map((o) => `<div class="supplier-order-line"><span>${o.quantity} × ${t('reserved').toLowerCase()}${o.code ? ` · <strong>${safe(o.code)}</strong>` : ''}</span><span><span class="status-pill ${o.status === 'ready_for_pickup' ? 'ready' : ''}">${statusText(o.status)}</span>${o.status === 'ready_for_pickup' ? `<button class="text-btn" data-action="complete-order" data-id="${safe(o.id)}">${t('markCollected')}</button>` : ''}</span></div>`).join('')}</details>`;
}

function renderOfferForm() {
  const defaultDate = new Date(Date.now() + 48 * 3600000 - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return `<form id="offer-form"><div class="form-grid">
    <div class="field span-2"><label for="new-type">${t('offerType')}</label><select id="new-type" name="type"><option value="group_buy">${t('groupBuy')}</option><option value="surplus">${t('surprise')}</option></select></div>
    <div class="field span-2"><label for="new-title">${t('title')} *</label><input id="new-title" name="title" placeholder="${t('titlePlaceholder')}" required maxlength="90" /></div>
    <div class="field span-2"><label for="new-description">${t('description')} *</label><textarea id="new-description" name="description" required maxlength="400"></textarea></div>
    <div class="field"><label for="new-price">${t('price')} *</label><input id="new-price" name="price" type="number" min="0.01" step="0.01" required /></div>
    <div class="field"><label for="new-unit">${t('unit')} *</label><input id="new-unit" name="unit" placeholder="maišas" required maxlength="30" /></div>
    <div class="field"><label for="new-stock">${t('quantity')} *</label><input id="new-stock" name="stock" type="number" min="1" step="1" required /></div>
    <div class="field" id="minimum-field"><label for="new-minimum">${t('minimum')}</label><input id="new-minimum" name="minimum" type="number" min="1" step="1" value="10" /></div>
    <div class="field span-2"><label for="new-deadline">${t('deadline')} *</label><input id="new-deadline" name="deadline" type="datetime-local" value="${defaultDate}" required /></div>
    <div class="field span-2"><label for="new-address">${t('pickupAddress')} *</label><input id="new-address" name="address" required maxlength="120" /></div>
    <div class="field span-2"><label for="new-pickup">${t('pickupTime')} *</label><input id="new-pickup" name="pickup" placeholder="Šeštadienį, 10:00–13:00" required maxlength="80" /></div>
    </div><p class="form-message" id="form-message" aria-live="polite"></p><button class="primary-btn" type="submit">${t('publish')} →</button></form>`;
}

function renderAdmin() {
  const pending = state.offers.filter((o) => o.status === 'pending_approval');
  const active = state.offers.filter((o) => ['open','minimum_reached','ready_for_pickup'].includes(o.status));
  const supplierCount = new Set(state.offers.map(o => o.supplierId)).size;
  return `<div class="page-heading"><div><p class="eyebrow">${t('workspace')}</p><h1>${t('adminTitle')}</h1><p class="page-subtitle">${t('adminSub')}</p></div></div>
    <div class="quick-stat-row"><div class="quick-stat"><span>${t('review')}</span><strong>${pending.length}</strong></div><div class="quick-stat"><span>${t('suppliers')}</span><strong>${supplierCount}</strong></div><div class="quick-stat"><span>${t('approvedOffers')}</span><strong>${active.length}</strong></div></div>
    <section class="panel"><div class="panel-head"><div><h2>${t('review')}</h2><p>${pending.length} ${t('statusPending').toLowerCase()}</p></div></div>
      ${pending.length ? `<div class="moderation-list">${pending.map(o => `<div class="moderation-card"><div class="order-main"><div class="mini-thumb" style="background:${safe(o.tone)}">${safe(o.emoji)}</div><div><strong>${safe(title(o))}</strong><span>${safe(o.supplier)} · ${money(o.priceCents)} / ${safe(o.unit)} · ${o.stock} ${t('available')}</span></div></div><div class="mod-actions"><button class="approve-btn" data-action="approve" data-id="${safe(o.id)}">${t('approve')}</button><button class="reject-btn" data-action="reject" data-id="${safe(o.id)}">${t('reject')}</button></div></div>`).join('')}</div>` : `<div class="empty-state"><div class="empty-icon">✅</div><h3>${t('noPending')}</h3><p>${t('allClear')}</p></div>`}
      ${renderLoadMore('offers', remoteOffersHaveMore)}
      <div class="admin-note">${isSharedMode() ? t('sharedInfo') : t('localOnly')}</div>
    </section>`;
}

function renderModal() {
  if (!modalOfferId) { modalRoot.innerHTML = ''; return; }
  const o = getOffer(modalOfferId);
  if (!o) { modalOfferId = null; modalOpener = null; modalRoot.innerHTML = ''; return; }
  const left = Math.max(0, o.stock - o.reservedQty);
  const group = o.type === 'group_buy';
  const amount = o.priceCents * modalQuantity;
  modalRoot.innerHTML = `<div class="modal-backdrop" data-action="backdrop-close"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1"><div class="modal-image" style="background:${safe(o.tone)}"><span class="food-emoji">${safe(o.emoji)}</span><button class="modal-close" data-action="close-modal" aria-label="${t('close')}">×</button></div><div class="modal-content"><p class="eyebrow">${safe(o.supplier)} · ${safe(o.neighborhood)}</p><h2 id="modal-title">${safe(title(o))}</h2><p>${safe(description(o))}</p>
    ${group ? `<div class="progress-wrap"><div class="progress-copy"><span>${t('groupProgress')}</span><strong>${o.reservedQty}/${o.minimum} ${t('min')}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${Math.min(100, Math.round(100*o.reservedQty/Math.max(1,o.minimum)))}%"></div></div></div>` : ''}
    <div class="modal-price-row"><div class="price">${money(o.priceCents)} <small>${t('per')} ${safe(o.unit)}</small></div><div class="qty-control"><button data-action="qty-minus" aria-label="Decrease quantity">−</button><strong>${modalQuantity}</strong><button data-action="qty-plus" aria-label="Increase quantity" ${modalQuantity >= left ? 'disabled' : ''}>+</button></div></div>
    <div class="pickup-info"><div>📍 <strong>${t('pickup')}:</strong> ${safe(o.address)}</div><div>🕒 <strong>${safe(o.pickup)}</strong></div><div>📦 ${left} ${t('available')} · ${t('total')}: <strong>${money(amount)}</strong></div></div>
    <button class="primary-btn" data-action="reserve" ${left <= 0 || reservationBusy ? 'disabled' : ''}>${reservationBusy ? '…' : `${t('addOrder')} · ${money(amount)}`}</button></div></section></div>`;
}

function closeOfferModal() {
  modalOfferId = null;
  renderModal();
  const opener = modalOpener;
  modalOpener = null;
  if (opener?.isConnected) opener.focus();
}

function trapOfferModalFocus(event) {
  if (!modalOfferId || event.key !== 'Tab') return;
  const focusable = [...(modalRoot.querySelectorAll?.('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
  if (!focusable.length) {
    event.preventDefault();
    modalRoot.querySelector?.('.modal')?.focus();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!focusable.includes(document.activeElement)) {
    event.preventDefault(); first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault(); last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault(); first.focus();
  }
}

function showToast(message) {
  document.querySelector('.toast')?.remove();
  const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; toast.setAttribute('role','status'); document.body.append(toast);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.remove(), 3200);
}

async function reserveOffer() {
  if (reservationBusy) return;
  const o = getOffer(modalOfferId);
  if (!o || !['open','minimum_reached'].includes(o.status) || offerHoursLeft(o) <= 0) { showToast(t('unavailable')); closeOfferModal(); return; }
  const left = o.stock - o.reservedQty;
  if (modalQuantity < 1 || modalQuantity > left) { showToast(t('notEnough')); return; }
  if (isSharedMode()) {
    reservationBusy = true;
    renderModal();
    try {
      const key = reservationKeyFor(o.id, modalQuantity);
      const response = await supabase('/rest/v1/rpc/create_reservation', { method: 'POST', body: JSON.stringify({ p_offer_id: o.id, p_quantity: modalQuantity, p_idempotency_key: key }) });
      const reservation = Array.isArray(response) ? response[0] : response;
      const code = reservation?.pickup_code || '';
      clearReservationKey(o.id, modalQuantity, key);
      modalOfferId = null;
      modalOpener = null;
      await loadRemoteData();
      showToast(t('successJoin') + code);
    } catch (error) { showToast(error.message || t('backendError')); }
    finally { reservationBusy = false; if (modalOfferId) renderModal(); }
    return;
  }
  o.reservedQty += modalQuantity;
  if (o.type === 'group_buy') o.status = o.reservedQty >= o.minimum ? 'minimum_reached' : 'open';
  const code = `KT${Math.random().toString(36).slice(2,6).toUpperCase()}`;
  state.orders.push({ id: `order-${Date.now()}`, offerId: o.id, buyerId: user().id, quantity: modalQuantity, totalCents: o.priceCents * modalQuantity, code, status: 'reserved', createdAt: new Date().toISOString() });
  modalOfferId = null; modalOpener = null; state.view = 'orders'; render(); showToast(t('successJoin') + code);
}

async function cancelOrder(id) {
  const order = state.orders.find(o => o.id === id && o.buyerId === user().id && o.status === 'reserved');
  if (!order) return;
  const offer = getOffer(order.offerId);
  if (!offer || !['open', 'minimum_reached'].includes(offer.status) || offerHoursLeft(offer) <= 0) { showToast(t('cancelUnavailable')); return; }
  if (isSharedMode()) {
    try { await supabase('/rest/v1/rpc/cancel_reservation', { method: 'POST', body: JSON.stringify({ p_reservation_id: id }) }); await loadRemoteData(); showToast(t('successCancel')); }
    catch (error) { showToast(error.message || t('backendError')); }
    return;
  }
  offer.reservedQty = Math.max(0, offer.reservedQty - order.quantity); if (offer.type === 'group_buy' && offer.reservedQty < offer.minimum) offer.status = 'open';
  order.status = 'cancelled'; render(); showToast(t('successCancel'));
}

async function completeOrder(id) {
  const order = state.orders.find((o) => o.id === id && o.status === 'ready_for_pickup');
  if (!order) return;
  const offer = getOffer(order.offerId);
  if (!offer || offer.supplierId !== user().supplierId) return;
  if (isSharedMode()) {
    try {
      await supabase('/rest/v1/rpc/supplier_complete_reservation', { method: 'POST', body: JSON.stringify({ p_reservation_id: id }) });
      await loadRemoteData();
      showToast(t('successCompleted'));
    } catch (error) { showToast(error.message || t('backendError')); }
    return;
  }
  order.status = 'completed'; render(); showToast(t('successCompleted'));
}

async function createOffer(form) {
  const data = new FormData(form);
  const type = data.get('type');
  const price = Number(data.get('price'));
  const stock = Number(data.get('stock'));
  const minimum = type === 'surplus' ? 0 : Number(data.get('minimum'));
  const deadlineValue = data.get('deadline');
  const deadline = deadlineValue ? new Date(deadlineValue) : null;
  if (!data.get('title') || !data.get('description') || !data.get('address') || !data.get('pickup') || !deadline || deadline <= new Date() || price <= 0 || stock < 1 || (type === 'group_buy' && (minimum < 1 || minimum > stock))) {
    const msg = document.getElementById('form-message'); if (msg) msg.textContent = t('required'); return;
  }
  if (isSharedMode()) {
    try {
      const area = remoteNeighborhoods.find(n => n.name === state.neighborhood);
      if (!area) throw new Error('Choose an active neighborhood.');
      await supabase('/rest/v1/rpc/submit_offer', { method: 'POST', body: JSON.stringify({
        p_offer_type: type, p_title: String(data.get('title')).trim(), p_description: String(data.get('description')).trim(),
        p_price_cents: Math.round(price * 100), p_unit: String(data.get('unit')).trim(), p_stock: stock,
        p_minimum: minimum, p_neighborhood_id: area.id, p_deadline: deadline.toISOString(),
        p_pickup_address: String(data.get('address')).trim(), p_pickup_details: String(data.get('pickup')).trim()
      }) });
      await loadRemoteData(); showToast(t('successOffer')); return;
    } catch (error) { const msg = document.getElementById('form-message'); if (msg) msg.textContent = error.message || t('backendError'); return; }
  }
  const cleanTitle = String(data.get('title')).trim();
  const supplier = state.currentRole === 'supplier' ? 'Švaru namams' : user().name;
  state.offers.unshift({ id: `offer-${Date.now()}`, type, name: cleanTitle, nameEn: cleanTitle, description: String(data.get('description')).trim(), descriptionEn: String(data.get('description')).trim(), supplierId: user().supplierId || 'sup-demo-new', supplier, emoji: type === 'surplus' ? '🥖' : '📦', tone: type === 'surplus' ? '#f3e1cb' : '#e5ebd8', priceCents: Math.round(price*100), unit: String(data.get('unit')).trim(), stock, minimum, reservedQty: 0, neighborhood: state.neighborhood, address: String(data.get('address')).trim(), pickup: String(data.get('pickup')).trim(), hoursLeft: Math.max(1, (deadline - Date.now()) / 3600000), deadline: deadline.toISOString(), status: 'pending_approval', tag: type === 'surplus' ? 'Mažiau atliekų' : 'Perkame kartu', distance: '1,0 km' });
  render(); showToast(t('successOffer'));
}

async function submitAuth(form) {
  const data = new FormData(form);
  const email = String(data.get('email') || '').trim();
  const password = String(data.get('password') || '');
  authBusy = true; authMessage = ''; remoteError = ''; renderAuth();
  try {
    if (authMode === 'recover') {
      const redirect = new URL(window.location.href); redirect.hash = '';
      await supabase(`/auth/v1/recover?redirect_to=${encodeURIComponent(redirect.toString())}`, { method: 'POST', body: JSON.stringify({ email }) });
      authMessage = t('recoverySent'); authBusy = false; renderAuth(); return;
    }
    if (authMode === 'update-password') {
      const confirmation = String(data.get('confirm_password') || '');
      if (password.length < 8 || password !== confirmation) {
        authBusy = false; renderAuth();
        const message = document.getElementById('auth-form-message');
        if (message) message.textContent = password !== confirmation ? t('passwordMismatch') : t('passwordTooShort');
        return;
      }
      await supabase('/auth/v1/user', { method: 'PUT', body: JSON.stringify({ password }) });
      try { await supabase('/auth/v1/logout', { method: 'POST' }); } catch { /* The password is already updated; local credentials are cleared either way. */ }
      persistAuthSession(null); remoteProfile = null; authMode = 'signin'; authMessage = t('passwordUpdated');
      authBusy = false; renderAuth(); return;
    }
    if (authMode === 'signup') {
      const result = await supabase('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email, password, data: { display_name: String(data.get('display_name') || '').trim(), phone: String(data.get('phone') || '').trim() } }) });
      if (result?.access_token) {
        persistAuthSession(result);
        await loadRemoteData();
        authBusy = false; if (!remoteProfile) renderAuth();
      } else {
        authMessage = t('checkEmail'); authBusy = false; renderAuth();
      }
    } else {
      const result = await supabase('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
      persistAuthSession(result);
      await loadRemoteData();
      authBusy = false; if (!remoteProfile) renderAuth();
    }
  } catch (error) {
    remoteError = error.message || t('authError'); authBusy = false; renderAuth();
  }
}

async function signOut() {
  try { if (authSession?.access_token) await supabase('/auth/v1/logout', { method: 'POST' }); } catch { /* local session is cleared even if logout cannot reach Supabase */ }
  persistAuthSession(null); remoteProfile = null; remoteError = ''; authMessage = ''; deletionMessage = ''; authMode = 'signin'; state.view = 'discover'; render();
}

async function handleClick(event) {
  if (deletionBusy) return;
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'go') { state.view = button.dataset.view; modalOfferId = null; modalOpener = null; render(); }
  else if (action === 'open-offer') { modalOpener = button; modalOfferId = button.dataset.id; modalQuantity = 1; renderModal(); modalRoot.querySelector?.('[data-action="close-modal"]')?.focus(); }
  else if (action === 'close-modal') closeOfferModal();
  else if (action === 'backdrop-close' && event.target === button) closeOfferModal();
  else if (action === 'qty-minus') { modalQuantity = Math.max(1, modalQuantity - 1); renderModal(); modalRoot.querySelector?.('[data-action="qty-minus"]')?.focus(); }
  else if (action === 'qty-plus') { const o = getOffer(modalOfferId); if (o) modalQuantity = Math.min(o.stock-o.reservedQty, modalQuantity+1); renderModal(); modalRoot.querySelector?.('[data-action="qty-plus"]')?.focus(); }
  else if (action === 'reserve') reserveOffer();
  else if (action === 'cancel-order') cancelOrder(button.dataset.id);
  else if (action === 'complete-order') await completeOrder(button.dataset.id);
  else if (action === 'load-more-offers') await loadMoreRemote('offers');
  else if (action === 'load-more-orders') await loadMoreRemote('orders');
  else if (action === 'category') { state.category = button.dataset.category; render(); document.getElementById('offers-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  else if (action === 'scroll-offers') document.getElementById('offers-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  else if (action === 'language') { state.lang = state.lang === 'lt' ? 'en' : 'lt'; render(); }
  else if (action === 'auth-mode') { authMode = button.dataset.mode; authMessage = ''; remoteError = ''; renderAuth(); }
  else if (action === 'use-demo') { localDemoOverride = true; remoteProfile = null; state = readState(); render(); }
  else if (action === 'retry-remote') await loadRemoteData();
  else if (action === 'export-account') { button.closest('details')?.removeAttribute('open'); await exportAccountData(); }
  else if (action === 'delete-account') { button.closest('details')?.removeAttribute('open'); await deleteAccount(); }
  else if (action === 'sign-out') await signOut();
  else if (action === 'cycle-role') { const roles = ['buyer','supplier','admin']; state.currentRole = roles[(roles.indexOf(state.currentRole)+1)%roles.length]; state.view = 'discover'; render(); }
  else if (action === 'approve' || action === 'reject') {
    const o = getOffer(button.dataset.id);
    if (isSharedMode()) {
      try { await supabase('/rest/v1/rpc/review_offer', { method: 'POST', body: JSON.stringify({ p_offer_id: button.dataset.id, p_approve: action === 'approve' }) }); await loadRemoteData(); showToast(action === 'approve' ? t('successApprove') : t('successReject')); }
      catch (error) { showToast(error.message || t('backendError')); }
    } else if (o?.status === 'pending_approval') { o.status = action === 'approve' ? 'open' : 'cancelled'; render(); showToast(action === 'approve' ? t('successApprove') : t('successReject')); }
  }
  else if (action === 'supplier-ready') {
    const o = getOffer(button.dataset.id);
    if (isSharedMode()) {
      try { await supabase('/rest/v1/rpc/supplier_mark_ready', { method: 'POST', body: JSON.stringify({ p_offer_id: button.dataset.id }) }); await loadRemoteData(); showToast(t('successReady')); }
      catch (error) { showToast(error.message || t('backendError')); }
    } else if (o && o.supplierId === user().supplierId && ['open','minimum_reached'].includes(o.status)) { o.status = 'ready_for_pickup'; state.orders.filter(order => order.offerId === o.id && order.status === 'reserved').forEach(order => order.status = 'ready_for_pickup'); render(); showToast(t('successReady')); }
  }
}

app.addEventListener('click', handleClick);
modalRoot.addEventListener('click', handleClick);
modalRoot.addEventListener('keydown', trapOfferModalFocus);
app.addEventListener('change', (event) => {
  if (event.target.dataset.change === 'neighborhood') { state.neighborhood = event.target.value; render(); }
  if (event.target.dataset.change === 'role') { state.currentRole = event.target.value; state.view = 'discover'; render(); }
});
app.addEventListener('submit', (event) => {
  if (event.target.id === 'offer-form') { event.preventDefault(); createOffer(event.target); }
  if (event.target.id === 'auth-form') { event.preventDefault(); submitAuth(event.target); }
});
app.addEventListener('change', (event) => {
  if (event.target.id === 'new-type') { const field = document.getElementById('minimum-field'); if (field) field.style.opacity = event.target.value === 'surplus' ? '.45' : '1'; }
});
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modalOfferId) closeOfferModal(); });

boot();
