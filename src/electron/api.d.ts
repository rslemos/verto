export interface ElectronApi {
  hello(name: string): Promise<string>;
}
