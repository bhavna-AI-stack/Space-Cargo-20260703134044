const hre = require("hardhat");

async function main() {
  const gameServerAddress = process.env.GAME_SERVER_ADDRESS;
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying SpaceCargoToken...");
  console.log("Deployer:", deployer.address);
  console.log("Game Server:", gameServerAddress);
  console.log("Admin:", deployer.address);

  const Token = await hre.ethers.getContractFactory("SpaceCargoToken");
  const token = await Token.deploy(gameServerAddress, deployer.address);
  await token.waitForDeployment();

  const address = await token.getAddress();
  console.log("SpaceCargoToken deployed to:", address);
  console.log("\nSave this address in your frontend and backend configuration!");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
