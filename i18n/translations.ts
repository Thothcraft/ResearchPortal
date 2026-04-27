export type Locale = 'en' | 'ar' | 'fr';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  fr: 'Français',
};

export const RTL_LOCALES: Locale[] = ['ar'];

type TranslationKeys = {
  // Navigation
  'nav.training': string;
  'nav.processing': string;
  'nav.devices': string;
  'nav.settings': string;
  'nav.logout': string;
  // Training page
  'training.title': string;
  'training.datasets': string;
  'training.jobs': string;
  'training.models': string;
  'training.comparison': string;
  'training.createDataset': string;
  'training.configureTraining': string;
  'training.startTraining': string;
  'training.datasetName': string;
  'training.description': string;
  'training.datasetType': string;
  'training.labels': string;
  'training.addLabel': string;
  'training.noDatasets': string;
  'training.noFiles': string;
  'training.preprocessing': string;
  'training.model': string;
  'training.optimization': string;
  'training.review': string;
  'training.trainTestSummary': string;
  'training.totalFiles': string;
  'training.totalLines': string;
  'training.deploy': string;
  'training.download': string;
  'training.rename': string;
  'training.delete': string;
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
  'nav.training': 'Training',
  'nav.processing': 'Processing',
  'nav.devices': 'Devices',
  'nav.settings': 'Settings',
  'nav.logout': 'Logout',
  'training.title': 'Training',
  'training.datasets': 'Datasets',
  'training.jobs': 'Jobs',
  'training.models': 'Models',
  'training.comparison': 'Comparison',
  'training.createDataset': 'Create Dataset',
  'training.configureTraining': 'Configure Training',
  'training.startTraining': 'Start Training',
  'training.datasetName': 'Dataset Name',
  'training.description': 'Description',
  'training.datasetType': 'Dataset Type',
  'training.labels': 'Labels',
  'training.addLabel': 'Add Label',
  'training.noDatasets': 'No datasets yet. Create one to get started.',
  'training.noFiles': 'No files in dataset. Add files to the dataset first.',
  'training.preprocessing': 'Preprocessing',
  'training.model': 'Model',
  'training.optimization': 'Optimization',
  'training.review': 'Review',
  'training.trainTestSummary': 'Train/Test Summary',
  'training.totalFiles': 'Total files',
  'training.totalLines': 'Total lines',
  'training.deploy': 'Deploy',
  'training.download': 'Download',
  'training.rename': 'Rename',
  'training.delete': 'Delete',
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
  'nav.training': 'التدريب',
  'nav.processing': 'المعالجة',
  'nav.devices': 'الأجهزة',
  'nav.settings': 'الإعدادات',
  'nav.logout': 'تسجيل الخروج',
  'training.title': 'التدريب',
  'training.datasets': 'مجموعات البيانات',
  'training.jobs': 'المهام',
  'training.models': 'النماذج',
  'training.comparison': 'المقارنة',
  'training.createDataset': 'إنشاء مجموعة بيانات',
  'training.configureTraining': 'إعداد التدريب',
  'training.startTraining': 'بدء التدريب',
  'training.datasetName': 'اسم مجموعة البيانات',
  'training.description': 'الوصف',
  'training.datasetType': 'نوع البيانات',
  'training.labels': 'التسميات',
  'training.addLabel': 'إضافة تسمية',
  'training.noDatasets': 'لا توجد مجموعات بيانات بعد. أنشئ واحدة للبدء.',
  'training.noFiles': 'لا توجد ملفات. أضف ملفات إلى مجموعة البيانات أولاً.',
  'training.preprocessing': 'المعالجة المسبقة',
  'training.model': 'النموذج',
  'training.optimization': 'التحسين',
  'training.review': 'المراجعة',
  'training.trainTestSummary': 'ملخص التدريب/الاختبار',
  'training.totalFiles': 'إجمالي الملفات',
  'training.totalLines': 'إجمالي الأسطر',
  'training.deploy': 'نشر',
  'training.download': 'تحميل',
  'training.rename': 'إعادة تسمية',
  'training.delete': 'حذف',
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
  'nav.training': 'Entraînement',
  'nav.processing': 'Traitement',
  'nav.devices': 'Appareils',
  'nav.settings': 'Paramètres',
  'nav.logout': 'Déconnexion',
  'training.title': 'Entraînement',
  'training.datasets': 'Jeux de données',
  'training.jobs': 'Tâches',
  'training.models': 'Modèles',
  'training.comparison': 'Comparaison',
  'training.createDataset': 'Créer un jeu de données',
  'training.configureTraining': 'Configurer l\'entraînement',
  'training.startTraining': 'Démarrer l\'entraînement',
  'training.datasetName': 'Nom du jeu de données',
  'training.description': 'Description',
  'training.datasetType': 'Type de données',
  'training.labels': 'Étiquettes',
  'training.addLabel': 'Ajouter une étiquette',
  'training.noDatasets': 'Aucun jeu de données. Créez-en un pour commencer.',
  'training.noFiles': 'Aucun fichier. Ajoutez des fichiers au jeu de données.',
  'training.preprocessing': 'Prétraitement',
  'training.model': 'Modèle',
  'training.optimization': 'Optimisation',
  'training.review': 'Vérification',
  'training.trainTestSummary': 'Résumé entraînement/test',
  'training.totalFiles': 'Fichiers totaux',
  'training.totalLines': 'Lignes totales',
  'training.deploy': 'Déployer',
  'training.download': 'Télécharger',
  'training.rename': 'Renommer',
  'training.delete': 'Supprimer',
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
