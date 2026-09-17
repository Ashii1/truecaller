import { CallLogItem, ContactItem } from '../../types';

export interface PhoneAccountInfo { id:string; label:string; carrierName:string; slotIndex:number; displayName:string; isDefault:boolean; }
export interface TelephonyDiagnosticsData {
  isDefaultDialer:boolean; isDialerRoleAvailable:boolean; isCallScreeningRoleHeld:boolean; isInCallServiceBound:boolean; hasSim:boolean;
  isAirplaneMode:boolean; isNetworkAvailable:boolean; networkOperatorName:string; simCarrierIdName:string;
  activeCallsCount:number; callLogPermission:boolean; contactsPermission:boolean; callPhonePermission:boolean; phoneStatePermission:boolean; answerCallsPermission:boolean; notificationsPermission:boolean;
  sim1Available:boolean; sim1Carrier:string; sim2Available:boolean; sim2Carrier:string; lastCallState?:string;
}

declare global {
  interface Window {
    AndroidTelecomBridge?: {
      checkDefaultDialerStatus:()=>string; requestDefaultDialerRole:()=>boolean; requestCallScreeningRole?:()=>boolean; requestDevicePermissions?:()=>boolean; openAppSettings?:()=>boolean;
      getPhoneAccounts:()=>string; getTelephonyDiagnostics:()=>string; placeRealCall:(number:string,accountHandleId?:string)=>string;
      answerCall:(callId:string)=>boolean; rejectCall:(callId:string,reason?:string)=>boolean; disconnectCall:(callId:string)=>boolean;
      setMuted:(muted:boolean)=>boolean; setSpeakerRoute:(enabled:boolean)=>boolean; sendDtmfTone:(callId:string,digit:string)=>boolean;
      holdCall:(callId:string)=>boolean; unholdCall:(callId:string)=>boolean; swapCalls:()=>boolean; mergeCalls:()=>boolean;
      fetchRealCallLogs:(limit:number)=>string; fetchRealContacts:(limit:number)=>string; lookupContactName?:(number:string)=>string;
      clearStaleCallNotifications?:()=>boolean;
      setSecuritySetting?:(key:string,value:boolean)=>boolean; syncBlockRules?:(json:string)=>boolean; createContact?:(number:string,name?:string)=>boolean;
    };
    __onAndroidTelecomEvent?:(eventType:string,payload:any)=>void;
    __onAndroidDialIntent?:(number:string)=>void;
  }
}

type Listener=(eventType:string,payload:any)=>void;
type DialListener=(number:string)=>void;

class TelecomBridgeService {
  private listeners=new Set<Listener>(); private dialListeners=new Set<DialListener>(); private defaultDialerConfirmed=false;
  private diagnosticsCache: { value: TelephonyDiagnosticsData; at: number } | null = null;
  private readonly diagnosticsCacheMs = 1500;
  constructor(){this.refreshStatus();this.initEvents();this.clearStaleCallNotifications();if(this.native()&&!this.defaultDialerConfirmed&&typeof window!=='undefined'){const promptedKey='vigilshield_default_role_prompted_v1';if(window.localStorage.getItem(promptedKey)!=='true'){window.localStorage.setItem(promptedKey,'true');window.setTimeout(()=>{if(!this.defaultDialerConfirmed)this.requestDefaultDialerRole();},700);}}}
  private native(){return typeof window!=='undefined'&&!!window.AndroidTelecomBridge;}
  private refreshStatus(){if(!this.native()){this.defaultDialerConfirmed=false;return;}try{this.defaultDialerConfirmed=!!JSON.parse(window.AndroidTelecomBridge!.checkDefaultDialerStatus()).isDefaultDialer;}catch{this.defaultDialerConfirmed=false;}}
  private initEvents(){if(typeof window==='undefined')return;window.__onAndroidTelecomEvent=(type,payload)=>{if(type==='ROLE_STATUS_CHANGED'){this.defaultDialerConfirmed=!!payload?.isDefaultDialer;this.diagnosticsCache=null;}this.listeners.forEach(l=>{try{l(type,payload);}catch(e){console.error(e);}});};window.__onAndroidDialIntent=n=>this.notifyDialIntent(n);}
  public notifyDialIntent(n:string){const v=(n||'').trim();if(v)this.dialListeners.forEach(l=>l(v));}
  public onDialIntent(l:DialListener){this.dialListeners.add(l);return()=>this.dialListeners.delete(l);}
  public onDialIntent(l:DialListener){this.dialListeners.add(l);return()=>this.dialListeners.delete(l);}
  public subscribe(l:Listener){this.listeners.add(l);return()=>this.listeners.delete(l);}
  public dispatchCallEvent(t:string,p:any){this.diagnosticsCache=null;this.listeners.forEach(l=>{try{l(t,p);}catch(e){console.error(e);}});}
  public isAndroidEnvironment(){return this.native();}
  public isDefaultDialer(){this.refreshStatus();return this.defaultDialerConfirmed;}
  public isDefaultPhoneApp(){return this.isDefaultDialer();}
  public requestDefaultDialerRole(){if(!this.native())return{success:false,message:'This is the web version. Install the Android app to use cellular calling.'};try{return window.AndroidTelecomBridge!.requestDefaultDialerRole()?{success:true,message:'Opening Android default Phone role…'}:{success:false,message:'Android did not open the dialer role request.'};}catch(e:any){return{success:false,message:e?.message||'Unable to request Phone role.'};}}
  public requestCallScreeningRole(){if(!this.native()||!window.AndroidTelecomBridge!.requestCallScreeningRole)return{success:false,message:'Call screening requires the Android app.'};try{return window.AndroidTelecomBridge!.requestCallScreeningRole()?{success:true,message:'Opening Android caller ID and spam protection role…'}:{success:false,message:'Android did not open the screening role request.'};}catch(e:any){return{success:false,message:e?.message||'Unable to request screening role.'};}}
  public requestDevicePermissions(){if(!this.native()||!window.AndroidTelecomBridge!.requestDevicePermissions)return{success:false,message:'Android permissions require the installed app.'};try{return window.AndroidTelecomBridge!.requestDevicePermissions()?{success:true,message:'Opening Android permission request…'}:{success:false,message:'No Android permissions are missing.'};}catch(e:any){return{success:false,message:e?.message||'Unable to request permissions.'};}}
  public openAppSettings(){if(!this.native()||!window.AndroidTelecomBridge!.openAppSettings)return{success:false,message:'App settings are only available on Android.'};try{return window.AndroidTelecomBridge!.openAppSettings()?{success:true,message:'Opening VigilShield app settings…'}:{success:false,message:'Unable to open app settings.'};}catch(e:any){return{success:false,message:e?.message||'Unable to open app settings.'};}}
  public getPhoneAccounts():PhoneAccountInfo[]{if(!this.native())return[];try{const a=JSON.parse(window.AndroidTelecomBridge!.getPhoneAccounts());return Array.isArray(a)?a.map((x:any)=>({id:String(x.id),label:x.label||'SIM',carrierName:x.carrierName||'Cellular',slotIndex:Number(x.slotIndex)||0,displayName:x.displayName||`SIM ${(Number(x.slotIndex)||0)+1}`,isDefault:!!x.isDefault})):[];}catch{return[];}}
  public placeRealCall(phoneNumber:string,accountHandleId?:string){const n=(phoneNumber||'').trim().replace(/[^\d+*#]/g,'');if(!n)return{success:false,message:'Phone number cannot be empty',dialableNumber:''};if(n.replace(/[^\d]/g,'').length<3)return{success:false,message:'Phone number is too short',dialableNumber:n};if(!this.native())return{success:false,message:'Cellular calling is unavailable in the web/Vercel version. Install the Android app and make it the default Phone app.',dialableNumber:n};try{const r=JSON.parse(window.AndroidTelecomBridge!.placeRealCall(n,accountHandleId));return{success:!!r.success,message:r.message||'Call request sent to Android Telecom',dialableNumber:n,callId:r.callId};}catch(e:any){return{success:false,message:e?.message||'Android Telecom could not place the call.',dialableNumber:n};}}
  public answerCall(id:string){if(!this.native())return false;return window.AndroidTelecomBridge!.answerCall(id);}
  public rejectCall(id:string,reason?:string){if(!this.native())return false;const res=window.AndroidTelecomBridge!.rejectCall(id,reason);this.clearStaleCallNotifications();return res;}
  public disconnectCall(id:string){if(!this.native())return false;const res=window.AndroidTelecomBridge!.disconnectCall(id);this.clearStaleCallNotifications();return res;}
  public silenceRinger(){if(!this.native()||!(window.AndroidTelecomBridge as any)?.silenceRinger)return false;try{return(window.AndroidTelecomBridge as any).silenceRinger();}catch{return false;}}
  public clearStaleCallNotifications(){if(!this.native()||!window.AndroidTelecomBridge!.clearStaleCallNotifications)return false;try{return window.AndroidTelecomBridge!.clearStaleCallNotifications();}catch{return false;}}
  public setMuted(v:boolean){return this.native()?window.AndroidTelecomBridge!.setMuted(v):false;} public setSpeakerRoute(v:boolean){return this.native()?window.AndroidTelecomBridge!.setSpeakerRoute(v):false;}
  public sendDtmfTone(id:string,d:string){return this.native()?window.AndroidTelecomBridge!.sendDtmfTone(id,d):false;} public holdCall(id:string){return this.native()?window.AndroidTelecomBridge!.holdCall(id):false;} public unholdCall(id:string){return this.native()?window.AndroidTelecomBridge!.unholdCall(id):false;} public swapCalls(){return this.native()?window.AndroidTelecomBridge!.swapCalls():false;} public mergeCalls(){return this.native()?window.AndroidTelecomBridge!.mergeCalls():false;}
  public fetchDeviceCallLogs(limit=100):CallLogItem[]{if(!this.native())return[];try{const a=JSON.parse(window.AndroidTelecomBridge!.fetchRealCallLogs(limit));return Array.isArray(a)?a.map((x:any)=>({...x,id:String(x.id),number:x.number||'',callerName:x.callerName||x.number||'Unknown caller',timestamp:Number(x.timestamp)||Date.now(),durationSeconds:Number(x.durationSeconds)||0,isSpam:!!x.isSpam,riskScore:Number(x.riskScore)||0,reportsCount:Number(x.reportsCount)||0,isContact:!!x.isContact,isVerifiedBusiness:!!x.isVerifiedBusiness,rawSource:'device_os' as const,identificationSource:x.identificationSource||'Android CallLog'})):[];}catch{return[];}}
  public fetchDeviceContacts(limit=200):ContactItem[]{if(!this.native())return[];try{const a=JSON.parse(window.AndroidTelecomBridge!.fetchRealContacts(limit));return Array.isArray(a)?a.map((x:any)=>({id:String(x.id),name:x.name||'Contact',number:x.number||'',category:'GENERAL',trusted:true,isFavorite:!!x.isFavorite,notes:'Android Contacts'})):[];}catch{return[];}}
  public lookupContactName(number:string):string|null{if(!this.native()||!number?.trim())return null;const nativeLookup=window.AndroidTelecomBridge!.lookupContactName;if(typeof nativeLookup!=='function')return null;try{return nativeLookup(number.trim())?.trim()||null;}catch{return null;}}
  public getDiagnostics():TelephonyDiagnosticsData{const now=Date.now();if(this.diagnosticsCache&&now-this.diagnosticsCache.at<this.diagnosticsCacheMs)return this.diagnosticsCache.value;let value:TelephonyDiagnosticsData;if(this.native())try{const x=JSON.parse(window.AndroidTelecomBridge!.getTelephonyDiagnostics());value={isDefaultDialer:!!x.isDefaultDialer,isDialerRoleAvailable:!!x.isDialerRoleAvailable,isCallScreeningRoleHeld:!!x.isCallScreeningRoleHeld,isInCallServiceBound:!!x.isInCallServiceBound,hasSim:!!x.hasSim,isAirplaneMode:!!x.isAirplaneMode,isNetworkAvailable:!!x.isNetworkAvailable,networkOperatorName:x.networkOperatorName||'Unknown',simCarrierIdName:x.simCarrierIdName||'Unknown',activeCallsCount:Number(x.activeCallsCount)||0,callLogPermission:!!x.callLogPermission,contactsPermission:!!x.contactsPermission,callPhonePermission:!!x.callPhonePermission,phoneStatePermission:!!x.phoneStatePermission,answerCallsPermission:!!x.answerCallsPermission,notificationsPermission:!!x.notificationsPermission,sim1Available:!!x.sim1Available,sim1Carrier:x.sim1Carrier||'None',sim2Available:!!x.sim2Available,sim2Carrier:x.sim2Carrier||'None',lastCallState:x.lastCallState||'IDLE'};}catch{value=this.webDiagnostics();}else value=this.webDiagnostics();this.diagnosticsCache={value,at:now};return value;}
  private webDiagnostics():TelephonyDiagnosticsData{return{isDefaultDialer:false,isDialerRoleAvailable:false,isCallScreeningRoleHeld:false,isInCallServiceBound:false,hasSim:false,isAirplaneMode:false,isNetworkAvailable:typeof navigator!=='undefined'?navigator.onLine:false,networkOperatorName:'Web',simCarrierIdName:'Unavailable',activeCallsCount:0,callLogPermission:false,contactsPermission:false,callPhonePermission:false,phoneStatePermission:false,answerCallsPermission:false,notificationsPermission:false,sim1Available:false,sim1Carrier:'Unavailable',sim2Available:false,sim2Carrier:'Unavailable',lastCallState:'IDLE'};}
  public setSecuritySetting(k:string,v:boolean){return this.native()&&!!window.AndroidTelecomBridge!.setSecuritySetting?window.AndroidTelecomBridge!.setSecuritySetting(k,v):false;} public syncBlockRules(r:any[]){return this.native()&&!!window.AndroidTelecomBridge!.syncBlockRules?window.AndroidTelecomBridge!.syncBlockRules(JSON.stringify(r)):false;} public createContact(n:string,name?:string){return this.native()&&!!window.AndroidTelecomBridge!.createContact?window.AndroidTelecomBridge!.createContact(n,name):false;}
}
export const telecomBridge=new TelecomBridgeService();
