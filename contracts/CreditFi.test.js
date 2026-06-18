const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("CreditFi", function () {
  let creditFi, owner, agent1, agent2, liquidator;

  beforeEach(async () => {
    [owner, agent1, agent2, liquidator] = await ethers.getSigners();
    const CreditFi = await ethers.getContractFactory("CreditFi");
    creditFi = await CreditFi.deploy();
    await creditFi.waitForDeployment();
    // Seed pool with 1 OG
    await owner.sendTransaction({ to: await creditFi.getAddress(), value: ethers.parseEther("1.0") });
  });

  // ── Registration ───────────────────────────────────────
  describe("Registration", () => {
    it("should register a new agent with score 500", async () => {
      await creditFi.connect(agent1).register();
      const a = await creditFi.getAgent(agent1.address);
      expect(a.creditScore).to.equal(500n);
      expect(a.registered).to.be.true;
    });

    it("should emit AgentRegistered event", async () => {
      await expect(creditFi.connect(agent1).register())
        .to.emit(creditFi, "AgentRegistered")
        .withArgs(agent1.address, 500n, anyValue); // anyValue = block.timestamp
    });

    it("should revert on double registration", async () => {
      await creditFi.connect(agent1).register();
      await expect(creditFi.connect(agent1).register())
        .to.be.revertedWith("CreditFi: already registered");
    });
  });

  // ── Deposit ────────────────────────────────────────────
  describe("Deposit", () => {
    beforeEach(async () => { await creditFi.connect(agent1).register(); });

    it("should accept collateral deposit", async () => {
      const amount = ethers.parseEther("0.5");
      await creditFi.connect(agent1).deposit({ value: amount });
      const a = await creditFi.getAgent(agent1.address);
      expect(a.deposited).to.equal(amount);
    });

    it("should emit Deposited event", async () => {
      const amount = ethers.parseEther("0.1");
      await expect(creditFi.connect(agent1).deposit({ value: amount }))
        .to.emit(creditFi, "Deposited")
        .withArgs(agent1.address, amount, amount); // 3rd arg = newTotal (equals amount on first deposit)
    });

    it("should revert on zero deposit", async () => {
      await expect(creditFi.connect(agent1).deposit({ value: 0 }))
        .to.be.revertedWith("CreditFi: deposit zero");
    });
  });

  // ── Borrow ─────────────────────────────────────────────
  describe("Borrow", () => {
    beforeEach(async () => {
      await creditFi.connect(agent1).register();
      await creditFi.connect(agent1).deposit({ value: ethers.parseEther("1.0") });
    });

    it("should allow borrow within credit limit", async () => {
      // Score 500 → LTV = 50 + (500-300)*25/550 ≈ 59.09%
      // Collateral 1 OG → limit ≈ 0.5909 OG
      const borrowAmt = ethers.parseEther("0.5");
      await creditFi.connect(agent1).borrow(borrowAmt);
      const a = await creditFi.getAgent(agent1.address);
      expect(a.borrowed).to.equal(borrowAmt);
    });

    it("should emit Borrowed event", async () => {
      const borrowAmt = ethers.parseEther("0.2");
      // Score 500 → LTV = 50 + (500-300)*25/550 = 59 (integer division)
      await expect(creditFi.connect(agent1).borrow(borrowAmt))
        .to.emit(creditFi, "Borrowed")
        .withArgs(agent1.address, borrowAmt, 500n, anyValue); // anyValue = ltv%
    });

    it("should revert when exceeding credit limit", async () => {
      // LTV ~59% of 1 OG = 0.59 OG limit; try to borrow 0.8 OG
      await expect(creditFi.connect(agent1).borrow(ethers.parseEther("0.8")))
        .to.be.revertedWith("CreditFi: exceeds credit limit");
    });

    it("should revert on double borrow", async () => {
      await creditFi.connect(agent1).borrow(ethers.parseEther("0.1"));
      await expect(creditFi.connect(agent1).borrow(ethers.parseEther("0.1")))
        .to.be.revertedWith("CreditFi: repay existing borrow first");
    });

    it("should boost LTV for high score agents", async () => {
      // Give agent1 a score of 850 → LTV = 75%
      await creditFi.connect(owner).updateCreditScore(agent1.address, 850);
      // 75% of 1 OG = 0.75 OG → should succeed
      await expect(creditFi.connect(agent1).borrow(ethers.parseEther("0.74")))
        .to.not.be.reverted;
    });
  });

  // ── Repay ──────────────────────────────────────────────
  describe("Repay", () => {
    beforeEach(async () => {
      await creditFi.connect(agent1).register();
      await creditFi.connect(agent1).deposit({ value: ethers.parseEther("1.0") });
      await creditFi.connect(agent1).borrow(ethers.parseEther("0.3"));
    });

    it("should clear borrow on repay", async () => {
      const owed = await creditFi.totalOwed(agent1.address);
      await creditFi.connect(agent1).repay({ value: owed + ethers.parseEther("0.01") });
      const a = await creditFi.getAgent(agent1.address);
      expect(a.borrowed).to.equal(0n);
    });

    it("should boost credit score by 20 on repay", async () => {
      const before = (await creditFi.getAgent(agent1.address)).creditScore;
      const owed = await creditFi.totalOwed(agent1.address);
      await creditFi.connect(agent1).repay({ value: owed + ethers.parseEther("0.01") });
      const after = (await creditFi.getAgent(agent1.address)).creditScore;
      expect(after).to.equal(before + 20n);
    });

    it("should refund overpayment", async () => {
      const owed = await creditFi.totalOwed(agent1.address);
      const overpay = ethers.parseEther("0.5");
      const balBefore = await ethers.provider.getBalance(agent1.address);
      const tx = await creditFi.connect(agent1).repay({ value: owed + overpay });
      const receipt = await tx.wait();
      const gasCost = receipt.gasUsed * tx.gasPrice;
      const balAfter = await ethers.provider.getBalance(agent1.address);
      // Net loss should be approximately owed + gas, not owed + overpay + gas
      const loss = balBefore - balAfter;
      expect(loss).to.be.lt(owed + overpay + gasCost);
    });

    it("should emit Repaid event", async () => {
      const owed = await creditFi.totalOwed(agent1.address);
      await expect(creditFi.connect(agent1).repay({ value: owed + ethers.parseEther("0.01") }))
        .to.emit(creditFi, "Repaid");
    });

    it("should revert if underpaying", async () => {
      await expect(creditFi.connect(agent1).repay({ value: ethers.parseEther("0.001") }))
        .to.be.revertedWith("CreditFi: insufficient repayment");
    });
  });

  // ── Credit Score Oracle ────────────────────────────────
  describe("Credit Score Oracle", () => {
    beforeEach(async () => { await creditFi.connect(agent1).register(); });

    it("should allow owner to update score", async () => {
      await creditFi.connect(owner).updateCreditScore(agent1.address, 750);
      const a = await creditFi.getAgent(agent1.address);
      expect(a.creditScore).to.equal(750n);
    });

    it("should revert on score below 300", async () => {
      await expect(creditFi.connect(owner).updateCreditScore(agent1.address, 299))
        .to.be.revertedWith("CreditFi: invalid score");
    });

    it("should revert on score above 850", async () => {
      await expect(creditFi.connect(owner).updateCreditScore(agent1.address, 851))
        .to.be.revertedWith("CreditFi: invalid score");
    });

    it("should revert when non-owner calls", async () => {
      await expect(creditFi.connect(agent1).updateCreditScore(agent1.address, 700))
        .to.be.revertedWith("CreditFi: not owner");
    });

    it("should emit ScoreUpdated event", async () => {
      await expect(creditFi.connect(owner).updateCreditScore(agent1.address, 720))
        .to.emit(creditFi, "ScoreUpdated")
        .withArgs(agent1.address, 500n, 720n, anyValue); // anyValue = block.timestamp
    });
  });

  // ── Liquidation ────────────────────────────────────────
  describe("Liquidation", () => {
    it("should revert liquidation on healthy position", async () => {
      await creditFi.connect(agent1).register();
      await creditFi.connect(agent1).deposit({ value: ethers.parseEther("1.0") });
      await creditFi.connect(agent1).borrow(ethers.parseEther("0.2"));
      await expect(creditFi.connect(liquidator).liquidate(agent1.address))
        .to.be.revertedWith("CreditFi: position healthy");
    });

    it("should revert liquidation with no borrow", async () => {
      await creditFi.connect(agent1).register();
      await expect(creditFi.connect(liquidator).liquidate(agent1.address))
        .to.be.revertedWith("CreditFi: no active borrow");
    });
  });

  // ── Withdraw ───────────────────────────────────────────
  describe("Withdraw", () => {
    beforeEach(async () => {
      await creditFi.connect(agent1).register();
      await creditFi.connect(agent1).deposit({ value: ethers.parseEther("0.5") });
    });

    it("should allow withdrawal with no borrow", async () => {
      await creditFi.connect(agent1).withdraw(ethers.parseEther("0.2"));
      const a = await creditFi.getAgent(agent1.address);
      expect(a.deposited).to.equal(ethers.parseEther("0.3"));
    });

    it("should revert withdrawal with active borrow", async () => {
      await creditFi.connect(agent1).borrow(ethers.parseEther("0.1"));
      await expect(creditFi.connect(agent1).withdraw(ethers.parseEther("0.1")))
        .to.be.revertedWith("CreditFi: repay borrow first");
    });
  });

  // ── View Functions ─────────────────────────────────────
  describe("View Functions", () => {
    beforeEach(async () => {
      await creditFi.connect(agent1).register();
      await creditFi.connect(agent1).deposit({ value: ethers.parseEther("1.0") });
    });

    it("maxBorrowable should return correct limit", async () => {
      const limit = await creditFi.maxBorrowable(agent1.address);
      // Score 500 → LTV = 50 + (500-300)*25/550 = 59.09%
      // 1 OG * 59.09% ≈ 0.5909 OG
      expect(limit).to.be.gt(ethers.parseEther("0.58"));
      expect(limit).to.be.lt(ethers.parseEther("0.60"));
    });

    it("poolBalance should reflect deposits", async () => {
      const bal = await creditFi.poolBalance();
      // 1 OG seed + 1 OG agent deposit
      expect(bal).to.be.gte(ethers.parseEther("2.0"));
    });

    it("agentCount should increment", async () => {
      expect(await creditFi.agentCount()).to.equal(1n);
      await creditFi.connect(agent2).register();
      expect(await creditFi.agentCount()).to.equal(2n);
    });
  });
});
