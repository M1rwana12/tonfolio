import { FIAT_DECIMALS, formatUnits, fromNano, valueInFiat } from '@tonfolio/shared';

import { CoinGeckoClient } from '../src/coingecko.js';
import { TonApiClient } from '../src/tonapi.js';

// TON Foundation treasury — a well-known busy mainnet account.
const DEFAULT_ADDRESS = 'EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N';

async function main(): Promise<void> {
  const address = process.argv[2] ?? DEFAULT_ADDRESS;
  const apiKey = process.env.TONAPI_KEY;
  const tonapi = new TonApiClient(apiKey ? { apiKey } : {});
  const coingecko = new CoinGeckoClient(
    process.env.COINGECKO_API_KEY ? { apiKey: process.env.COINGECKO_API_KEY } : {},
  );

  const account = await tonapi.getAccount(address);
  const jettons = await tonapi.getJettonBalances(address);
  const txs = await tonapi.getTransactions(address, { limit: 5 });
  const prices = await coingecko.getPrices(['the-open-network']);
  const tonPrice = prices.get('the-open-network');

  console.log(`\nAddress:  ${address}`);
  console.log(`Status:   ${account.status}`);

  const ton = fromNano(account.balance, { maxFraction: 2, group: true });
  if (tonPrice) {
    const usd = valueInFiat(account.balance, 9, tonPrice.usd);
    const usdText = formatUnits(usd, FIAT_DECIMALS, { maxFraction: 2, group: true });
    console.log(`Balance:  ${ton} TON  (~$${usdText})`);
    const price = formatUnits(tonPrice.usd, FIAT_DECIMALS, { maxFraction: 4 });
    const priceUah = formatUnits(tonPrice.uah, FIAT_DECIMALS, { maxFraction: 2 });
    console.log(`TON/USD:  $${price}  |  TON/UAH: ₴${priceUah}`);
  } else {
    console.log(`Balance:  ${ton} TON`);
  }

  console.log(`\nJettons (${jettons.length}):`);
  for (const jetton of jettons.slice(0, 10)) {
    const amount = formatUnits(jetton.amount, jetton.decimals, { maxFraction: 2, group: true });
    console.log(`  ${jetton.symbol.padEnd(8)} ${amount}`);
  }

  console.log(`\nLast ${txs.length} transactions:`);
  for (const tx of txs) {
    const when = new Date(tx.utime * 1000).toISOString();
    const valueIn = fromNano(tx.valueIn, { maxFraction: 4 });
    console.log(`  ${when}  lt=${tx.lt}  in=${valueIn} TON  ${tx.hash.slice(0, 16)}…`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
