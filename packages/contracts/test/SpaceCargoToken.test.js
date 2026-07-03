const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SpaceCargoToken", function () {
  let token, admin, gameServer, player1, player2;
  const MIN_CLAIM = ethers.parseEther("100");

  // Helper to create EIP-712 signature
  async function signReward(signer, contractAddress, playerAddress, amount, nonce) {
    const domain = {
      name: "SpaceCargoToken",
      version: "1",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: contractAddress,
    };
    const types = {
      Reward: [
        { name: "player", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
      ],
    };
    const value = { player: playerAddress, amount: amount, nonce: nonce };
    return await signer.signTypedData(domain, types, value);
  }

  beforeEach(async function () {
    [admin, gameServer, player1, player2] = await ethers.getSigners();
    const TokenFactory = await ethers.getContractFactory("SpaceCargoToken");
    token = await TokenFactory.deploy(gameServer.address, admin.address);
    await token.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct token name and symbol", async function () {
      expect(await token.name()).to.equal("Space Cargo Runner");
      expect(await token.symbol()).to.equal("SCR");
    });

    it("Should grant roles correctly", async function () {
      const GAME_SERVER_ROLE = await token.GAME_SERVER_ROLE();
      const ADMIN_ROLE = await token.ADMIN_ROLE();
      expect(await token.hasRole(GAME_SERVER_ROLE, gameServer.address)).to.be.true;
      expect(await token.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("Should start with zero supply", async function () {
      expect(await token.totalSupply()).to.equal(0);
    });

    it("Should set default min claim amount", async function () {
      expect(await token.minClaimAmount()).to.equal(MIN_CLAIM);
    });
  });

  describe("Claiming Rewards", function () {
    it("Should allow valid reward claim", async function () {
      const amount = ethers.parseEther("500");
      const nonce = 0n;
      const contractAddr = await token.getAddress();
      const sig = await signReward(gameServer, contractAddr, player1.address, amount, nonce);

      await expect(token.connect(player1).claimReward(amount, nonce, sig))
        .to.emit(token, "RewardClaimed")
        .withArgs(player1.address, amount, nonce);

      expect(await token.balanceOf(player1.address)).to.equal(amount);
      expect(await token.nonces(player1.address)).to.equal(1n);
    });

    it("Should reject invalid signature", async function () {
      const amount = ethers.parseEther("500");
      const nonce = 0n;
      const contractAddr = await token.getAddress();
      // player1 signs instead of gameServer
      const sig = await signReward(player1, contractAddr, player1.address, amount, nonce);

      await expect(token.connect(player1).claimReward(amount, nonce, sig))
        .to.be.revertedWith("Invalid signature");
    });

    it("Should reject replayed nonce", async function () {
      const amount = ethers.parseEther("500");
      const nonce = 0n;
      const contractAddr = await token.getAddress();
      const sig = await signReward(gameServer, contractAddr, player1.address, amount, nonce);

      await token.connect(player1).claimReward(amount, nonce, sig);

      // Try to replay same nonce
      await expect(token.connect(player1).claimReward(amount, nonce, sig))
        .to.be.revertedWith("Invalid nonce");
    });

    it("Should reject amount below minimum", async function () {
      const amount = ethers.parseEther("50"); // below 100 minimum
      const nonce = 0n;
      const contractAddr = await token.getAddress();
      const sig = await signReward(gameServer, contractAddr, player1.address, amount, nonce);

      await expect(token.connect(player1).claimReward(amount, nonce, sig))
        .to.be.revertedWith("Amount below minimum");
    });

    it("Should allow multiple sequential claims", async function () {
      const contractAddr = await token.getAddress();
      const amount1 = ethers.parseEther("200");
      const amount2 = ethers.parseEther("300");

      const sig1 = await signReward(gameServer, contractAddr, player1.address, amount1, 0n);
      await token.connect(player1).claimReward(amount1, 0n, sig1);

      const sig2 = await signReward(gameServer, contractAddr, player1.address, amount2, 1n);
      await token.connect(player1).claimReward(amount2, 1n, sig2);

      expect(await token.balanceOf(player1.address)).to.equal(amount1 + amount2);
      expect(await token.nonces(player1.address)).to.equal(2n);
    });

    it("Should reject claims when paused", async function () {
      await token.connect(admin).pause();

      const amount = ethers.parseEther("500");
      const nonce = 0n;
      const contractAddr = await token.getAddress();
      const sig = await signReward(gameServer, contractAddr, player1.address, amount, nonce);

      await expect(token.connect(player1).claimReward(amount, nonce, sig))
        .to.be.reverted;
    });
  });

  describe("Admin Functions", function () {
    it("Should allow admin to update min claim amount", async function () {
      const newMin = ethers.parseEther("50");
      await expect(token.connect(admin).setMinClaimAmount(newMin))
        .to.emit(token, "MinClaimAmountUpdated")
        .withArgs(MIN_CLAIM, newMin);
      expect(await token.minClaimAmount()).to.equal(newMin);
    });

    it("Should reject non-admin from updating min claim", async function () {
      const newMin = ethers.parseEther("50");
      await expect(token.connect(player1).setMinClaimAmount(newMin))
        .to.be.reverted;
    });

    it("Should allow admin to pause and unpause", async function () {
      await token.connect(admin).pause();
      expect(await token.paused()).to.be.true;
      await token.connect(admin).unpause();
      expect(await token.paused()).to.be.false;
    });
  });
});
