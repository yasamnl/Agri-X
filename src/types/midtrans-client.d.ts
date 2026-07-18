declare module 'midtrans-client' {
  export interface SnapConfig {
    isProduction?: boolean;
    serverKey?: string;
    clientKey?: string;
  }

  class Snap {
    constructor(config: SnapConfig);
    createTransaction(parameters: any): any;
    createTransactionToken(parameters: any): any;
  }

  class CoreApi {
    constructor(config: SnapConfig);
    charge(parameters: any): any;
  }

  const midtransClient: {
    Snap: typeof Snap;
    CoreApi: typeof CoreApi;
  };

  export default midtransClient;
}
