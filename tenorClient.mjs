import tenorFetchModule from 'tenor-fetch';
console.log(tenorFetchModule); // { default: [Function: TenorFetch] }

// デフォルトエクスポートから関数を取り出して使用
const TenorFetch = tenorFetchModule.default;
const tenorClient = new TenorFetch(process.env.tenor_apikey);

export default tenorClient;