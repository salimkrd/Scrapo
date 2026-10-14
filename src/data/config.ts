// Configurable Demo Settings & Yard Notices

export interface YardNotice {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  time?: string;
  type: 'DISPATCH' | 'MAINTENANCE' | 'ALERT';
}

export interface YardConfig {
  yardId: string;
  defaultSupervisor: string;
  activeNotices: YardNotice[];
  availableScaleDevices: { id: string; name: string; port: string; status: 'ONLINE' | 'OFFLINE' }[];
}

export const DEMO_CONFIG: YardConfig = {
  yardId: 'yard_kochi_02',
  defaultSupervisor: 'Anoop Kumar',
  activeNotices: [
    {
      id: 'notice_dispatch_1',
      title: 'Trailer Dispatch scheduled at 04:30 PM',
      subtitle: 'Regional Scrap Logistics Hub • Target: 12 Tons',
      icon: 'local_shipping',
      time: '04:30 PM',
      type: 'DISPATCH',
    },
  ],
  availableScaleDevices: [
    {
      id: 'CAS-CI-2001-YARD02',
      name: 'CAS CI-2001 Platform Scale (500 KG)',
      port: 'Bluetooth Yard Port 02',
      status: 'ONLINE',
    },
  ],
};
