import * as didJwt from 'did-jwt'

import { Resolver } from "did-resolver"

import CeramicClient from '@ceramicnetwork/ceramic-http-client';
import KeyDidResolver from '@ceramicnetwork/key-did-resolver';
import ThreeIdResolver from '@ceramicnetwork/3id-did-resolver';
import { CeramicApi  } from "@ceramicnetwork/ceramic-common";

import Contextual from "../contextual";
import Context from "../context";

import base64url from "base64url"

import { Ipfs } from 'ipfs';
import ipfsClient from "ipfs-http-client";
import { config } from "node-config-ts";

import dagJose from 'dag-jose'
// @ts-ignore
import multiformats from 'multiformats/basics'
// @ts-ignore
import legacy from 'multiformats/legacy'

const DID_MATCHER = '^(did:([a-zA-Z0-9_]+):([a-zA-Z0-9_.-]+(:[a-zA-Z0-9_.-]+)*)((;[a-zA-Z0-9_.:%-]+=[a-zA-Z0-9_.:%-]*)*)(/[^#?]*)?)([?][^#]*)?(#.*)?';

export default class CeramicService implements Contextual {

  private _ipfs: Ipfs;

  private _client: CeramicApi;
  private _resolver: Resolver;

  /**
   * Sets dependencies
   * @param context - Application context
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  setContext(context: Context): void {
    if (config.ceramic.validateRecords) {
      this._client = new CeramicClient(config.ceramic.apiUrl);

      const keyDidResolver = KeyDidResolver.getResolver();
      const threeIdResolver = ThreeIdResolver.getResolver(this._client);
      this._resolver = new Resolver({
        ...threeIdResolver, ...keyDidResolver,
      })
    }
  }

  /**
   * Initialize the service
   */
  public async init(): Promise<void> {
    multiformats.multicodec.add(dagJose);
    const format = legacy(multiformats, dagJose.name);

    this._ipfs = ipfsClient({ url: config.ipfsConfig.host, ipld: { formats: [format] } })
  }

  /**
   * Get IPFS client
   */
  get ipfs(): Ipfs {
    return this._ipfs
  }

  /**
   * Verifies record signature
   * @param record - Record data
   * @return DID
   * @private
   */
  async verifySignedRecord(record: any): Promise<string> {
    const { payload, signatures } = record;
    const { signature, protected: _protected } = signatures[0];

    const decodedHeader = JSON.parse(base64url.decode(_protected));
    const { kid } = decodedHeader;

    const didDoc = await this._resolver.resolve(kid);
    const jws = [_protected, payload, signature].join(".");
    await didJwt.verifyJWS(jws, didDoc.publicKey);
    return kid.match(RegExp(DID_MATCHER))[1];
  }

}