// scripts/deploy.js
// CreditFi — Hardhat deploy script for 0G Chain (testnet + mainnet)
// Usage: npx hardhat run scripts/deploy.js --network 0g-testnet

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  CreditFi — 0G Bridge Buildathon · Deploy");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // Get deployer
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`  Network     : ${network.name}`);
  console.log(`  Deployer    : ${deployer.address}`);
  console.log(`  Balance     : ${ethers.formatEther(balance)} OG`);
  console.log("");

  if (balance === 0n) {
    throw new Error(
      "Deployer has 0 OG. Get testnet tokens at https://faucet.0g.ai/"
    );
  }

  // Deploy CreditFi
  console.log("  Deploying CreditFi.sol ...");
  const CreditFi = await ethers.getContractFactory("CreditFi");
  const creditfi = await CreditFi.deploy();
  await creditfi.waitForDeployment();

  const address = await creditfi.getAddress();
  console.log(`  ✓ Deployed  : ${address}`);

  // Fund pool with 0.1 OG so borrowing works immediately
  const POOL_SEED = ethers.parseEther("0.1");
  if (balance >= POOL_SEED * 2n) {
    console.log("  Funding pool with 0.1 OG ...");
    const tx = await creditfi.fundPool({ value: POOL_SEED });
    await tx.wait();
    console.log(`  ✓ Pool funded: 0.1 OG`);
  } else {
    console.log("  ⚠ Skipped pool funding — low balance");
  }

  // Print explorer link
  const explorerBase =
    network.name === "0g-mainnet"
      ? "https://chainscan.0g.ai/address"
      : "https://chainscan-galileo.0g.ai/address";

  console.log(`\n  Explorer    : ${explorerBase}/${address}`);

  // Save deployment info
  const deployInfo = {
    network: network.name,
    contractAddress: address,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    explorerUrl: `${explorerBase}/${address}`,
  };

  const outPath = path.join(__dirname, "..", "deployed.json");

  // Merge with existing deployments
  let existing = {};
  if (fs.existsSync(outPath)) {
    try {
      existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
    } catch (_) {}
  }
  existing[network.name] = deployInfo;
  fs.writeFileSync(outPath, JSON.stringify(existing, null, 2));
  console.log(`  ✓ Saved     : deployed.json\n`);

  // Print next steps
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Next steps:");
  console.log(`  1. Copy ${address} into frontend/index.html`);
  console.log(`     → Set CONTRACT_ADDRESS = "${address}"`);
  console.log(
    "  2. Run the AI scorer oracle:"
  );
  console.log("     python scripts/credit_scorer.py");
  console.log("  3. Open frontend/index.html in browser");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n❌ Deploy failed:", err.message);
  process.exitCode = 1;
});
