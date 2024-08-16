//import TenorFetch from 'tenor-fetch';

// TenorのAPIキーを設定
//const tenorClient = new TenorFetch(process.env.tenor_apikey);
import TenorFetch from 'tenor-fetch';

const tf = new TenorFetch(process.env.tenor_apikey);

export default tf;