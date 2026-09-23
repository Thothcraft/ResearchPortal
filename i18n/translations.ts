export type Locale = 'en' | 'ar' | 'fr';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

export const RTL_LOCALES: Locale[] = ['ar'];

type TranslationKeys = {
  // Navigation
  'nav.devices': string;
  'nav.settings': string;
  'nav.logout': string;
  // Dataset types
  'datasetType.csi': string;
  'datasetType.image': string;
  'datasetType.imu': string;
  'datasetType.audio': string;
  'datasetType.mixed': string;
  'datasetType.other': string;
  // Common
  'common.save': string;
  'common.cancel': string;
  'common.back': string;
  'common.next': string;
  'common.create': string;
  'common.loading': string;
  'common.noResults': string;
  'common.search': string;
  'common.refresh': string;
  'common.export': string;
  'common.actions': string;
  // Deploy
  'deploy.title': string;
  'deploy.selectDevice': string;
  'deploy.noDevices': string;
  'deploy.deploying': string;
  // Auth
  'auth.login': string;
  'auth.username': string;
  'auth.password': string;
  'auth.signIn': string;
};

const en: TranslationKeys = {
  'nav.devices': 'Devices',
  'nav.settings': 'Settings',
  'nav.logout': 'Logout',
  'datasetType.csi': 'CSI',
  'datasetType.image': 'Image',
  'datasetType.imu': 'IMU',
  'datasetType.audio': 'Audio',
  'datasetType.mixed': 'Mixed',
  'datasetType.other': 'Other',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.back': 'Back',
  'common.next': 'Next',
  'common.create': 'Create',
  'common.loading': 'Loading...',
  'common.noResults': 'No results',
  'common.search': 'Search',
  'common.refresh': 'Refresh',
  'common.export': 'Export',
  'common.actions': 'Actions',
  'deploy.title': 'Deploy Model',
  'deploy.selectDevice': 'Target Device',
  'deploy.noDevices': 'No devices registered. Connect a Thoth device first.',
  'deploy.deploying': 'Deploying...',
  'auth.login': 'Login',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.signIn': 'Sign In',
};

const ar: TranslationKeys = {
  'nav.devices': 'الأجهزة',
  'nav.settings': 'الإعدادات',
  'nav.logout': 'تسجيل الخروج',
  'datasetType.csi': 'CSI',
  'datasetType.image': 'صورة',
  'datasetType.imu': 'IMU',
  'datasetType.audio': 'صوت',
  'datasetType.mixed': 'مختلط',
  'datasetType.other': 'أخرى',
  'common.save': 'حفظ',
  'common.cancel': 'إلغاء',
  'common.back': 'رجوع',
  'common.next': 'التالي',
  'common.create': 'إنشاء',
  'common.loading': 'جارٍ التحميل...',
  'common.noResults': 'لا توجد نتائج',
  'common.search': 'بحث',
  'common.refresh': 'تحديث',
  'common.export': 'تصدير',
  'common.actions': 'إجراءات',
  'deploy.title': 'نشر النموذج',
  'deploy.selectDevice': 'الجهاز المستهدف',
  'deploy.noDevices': 'لا توجد أجهزة مسجلة. قم بتوصيل جهاز Thoth أولاً.',
  'deploy.deploying': 'جارٍ النشر...',
  'auth.login': 'تسجيل الدخول',
  'auth.username': 'اسم المستخدم',
  'auth.password': 'كلمة المرور',
  'auth.signIn': 'دخول',
};

const fr: TranslationKeys = {
  'nav.devices': 'Appareils',
  'nav.settings': 'Paramètres',
  'nav.logout': 'Déconnexion',
  'datasetType.csi': 'CSI',
  'datasetType.image': 'Image',
  'datasetType.imu': 'IMU',
  'datasetType.audio': 'Audio',
  'datasetType.mixed': 'Mixte',
  'datasetType.other': 'Autre',
  'common.save': 'Enregistrer',
  'common.cancel': 'Annuler',
  'common.back': 'Retour',
  'common.next': 'Suivant',
  'common.create': 'Créer',
  'common.loading': 'Chargement...',
  'common.noResults': 'Aucun résultat',
  'common.search': 'Rechercher',
  'common.refresh': 'Actualiser',
  'common.export': 'Exporter',
  'common.actions': 'Actions',
  'deploy.title': 'Déployer le modèle',
  'deploy.selectDevice': 'Appareil cible',
  'deploy.noDevices': 'Aucun appareil enregistré. Connectez d\'abord un appareil Thoth.',
  'deploy.deploying': 'Déploiement...',
  'auth.login': 'Connexion',
  'auth.username': 'Nom d\'utilisateur',
  'auth.password': 'Mot de passe',
  'auth.signIn': 'Se connecter',
};

export const translations: Record<Locale, TranslationKeys> = { en, ar, fr };

export type TranslationKey = keyof TranslationKeys;
