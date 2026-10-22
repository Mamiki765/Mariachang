import axios from "axios";

export function postRev2Graphql(payload, options) {
  return axios.post(
    `https://rev2.reversion.jp/graphql?opname=${payload.operationName}`,
    payload,
    { ...options, timeout: 15_000 }
  );
}
