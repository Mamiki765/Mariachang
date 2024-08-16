import tenorFetch from 'tenor-fetch';

// TenorのAPIキーを設定
const tenorClient = tenorFetch(process.env.tenor_apikey);

export default tenorClient;