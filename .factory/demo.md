# Demo sandbox

## Browser sample

Open [https://config-drift-timeline.sociobot.in/demo/](https://config-drift-timeline.sociobot.in/demo/), or use the landing page’s **Try it with sample data** action. It loads four realistic incident captures without asking for files or an account.

The persistent **Demo — sample data, nothing is saved** banner has **Reset demo** and **Start for real** controls. The browser stores only the selected capture under `demo:config-drift-timeline:step`. It never reads or writes real product data, including license storage. Reset removes that demo key; Start for real removes it before returning home.

## CLI sample

Run the shipped artifact with one command:

```sh
driftline demo
```

The command writes bundled `staging.yaml`, `production.yaml`, `demo.env`, and `demo.json` only into a new operating-system temporary directory. It captures them into a redacted ledger, writes `drift-report.json`, prints the report location, and does not read or alter user files. Remove the printed temporary directory when finished.

The sample uses the same YAML, dotenv, and JSON parsing as the CLI. It includes a production replica difference, a secret-like value versus null, an absent cache key, and a JSON layer overriding a YAML value.
