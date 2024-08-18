import { IRawPlugin } from '../../types/plugins/raw';

export class RawPlugin implements IRawPlugin {
  name: string = 'Default_Plugin_Name';
  activated: boolean = false;

  activate() {}
  
  deactivate() {}
};