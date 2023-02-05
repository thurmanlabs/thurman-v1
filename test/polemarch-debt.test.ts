import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";

describe("polemarch-debt", function() {
  let deployer: SignerWithAddress;
  let users: SignerWithAddress[];
  let polemarch: Polemarch;
  let weth: WETH9;
  let sWETH: SToken;
  let dWETH: DToken;

  beforeEach(async () => {
    const testEnv: TestEnv = await createTestEnv();
    deployer = testEnv.deployer;
    users = testEnv.users;
    polemarch = testEnv.polemarch;
    weth = testEnv.weth;
    sWETH = testEnv.sWETH;
    dWETH = testEnv.dWETH;
  });

  describe("debt-service create-line-of-credit", () => {
    it("reverts when a borrowMax is not greater than 0", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await expect(polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0"), 
        parseEther("0.05"),
        14
      )).to.be.revertedWith("INVALID_BORROW_MAX");
    });

    it("reverts createLineOfCredit when exchequer is inactive", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.05"), 
        parseEther("0.05"),
        14
      )).to.be.revertedWith("EXCHEQUER_INACTIVE");
    });

    it("reverts when the borrowMax is larger than the underlying asset balance", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await expect(polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.51"), 
        parseEther("0.05"),
        14
      )).to.be.revertedWith("NOT_ENOUGH_UNDERLYING_ASSET_BALANCE");
    });

    it("reverts when the borrowMax leads pushes total debt over the borrow cap", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.setBorrowCap(weth.address, parseEther("0.25"));
      await expect(polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.26"), 
        parseEther("0.05"),
        14
      )).to.be.revertedWith("EXCHEQUER_MUST_STAY_BELOW_BORROW_CAP");
    });

    it("reverts when a user already has an open line of credit", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await expect(polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.2"), 
        parseEther("0.05"),
        14
      )).to.be.revertedWith("USER_ALREADY_HAS_BORROW_POSITION");
    });

    it("reverts when attempting to create a line of credit for a deliquent borrower", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.01"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.markDelinquent(weth.address, deployer.address);
      await expect(polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.2"), 
        parseEther("0.05"),
        7
      )).to.be.revertedWith("USER_HAS_DELIQUENT_DEBT");
    });

    // it("emits a createLineOfCredit event", async () => {
    //   await weth.deposit({ value: parseEther("0.5") });
    //   await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
    //   await weth.approve(polemarch.address, parseEther("0.5"));
    //   await polemarch.supply(weth.address, parseEther("0.5"));
    //   await polemarch.setExchequerBorrowing(weth.address, true);

    //   const sevenDays = 7 * 24 * 60 * 60;
    //   await ethers.provider.send('evm_increaseTime', [sevenDays]);
    //   await ethers.provider.send('evm_mine');

    //   const blockNumAfter = await ethers.provider.getBlockNumber();
    //   const blockAfter = await ethers.provider.getBlock(blockNumAfter);
    //   const timestampAfter = blockAfter.timestamp;

    //   await expect(polemarch.createLineOfCredit(
    //     deployer.address, 
    //     weth.address, 
    //     parseEther("0.1"), 
    //     parseEther("0.05"),
    //     14
    //   ))
    //     .to.emit(polemarch, "CreateLineOfCredit")
    //     .withArgs(
    //       1, 
    //       parseEther("0.05"), 
    //       deployer.address, 
    //       weth.address, 
    //       parseEther("0.1"), 
    //       (timestampAfter + (14 * 24 * 60 * 60))
    //   );
    // })
  });

  describe("debt-service borrow", () => {
    it("reverts if user attempts to borrow zero", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.25"), 
        parseEther("0.05"),
        14
      );
      await expect(polemarch.borrow(weth.address, parseEther("0"))).to.be.revertedWith(
        "INVALID_AMOUNT"
      );
    });

    it("reverts when the exchequer is not active", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.25"), 
        parseEther("0.05"),
        14
      );
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.borrow(weth.address, parseEther("0.1"))).to.be.revertedWith(
        "EXCHEQUER_INACTIVE"
      );
    });

    it("reverts when borrowing is not enables", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.25"), 
        parseEther("0.05"),
        14
      );
      await polemarch.setExchequerBorrowing(weth.address, false);
      await expect(polemarch.borrow(weth.address, parseEther("0.1"))).to.be.revertedWith(
        "BORROWING_NOT_ENABLED"
      );
    });

    it("reverts when a user does not have a line of credit", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await expect(polemarch.borrow(weth.address, parseEther("0.1"))).to.be.revertedWith(
        "USER_DOES_NOT_HAVE_LINE_OF_CREDIT"
      );
    });

    it("reverts when a user tries to borrow over their borrowMax", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.25"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.1"));
      await ethers.provider.send('evm_increaseTime', [24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.borrow(weth.address, parseEther("0.16"))).to.be.revertedWith(
        "USER_CANNOT_BORROW_OVER_MAX_LIMIT"
      );
    });

    it("reverts when the line of credit expiration time has passed", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.25"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.1"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.borrow(weth.address, parseEther("0.1"))).to.be.revertedWith(
        "LINE_OF_CREDIT_EXPIRED"
      );
    });

    it("reverts when a line of credit is delinquent", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.01"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.markDelinquent(weth.address, deployer.address);
      await expect(polemarch.borrow(weth.address, parseEther("0.02"))).to.be.revertedWith(
        "USER_HAS_DELIQUENT_DEBT"
      );
    });

    it("emits a borrow event", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(deployer.address);
      const rate = await dWETH.userRate(deployer.address);
      await expect(polemarch.borrow(weth.address, parseEther("0.04")))
        .to.emit(polemarch, "Borrow")
        .withArgs(loc.id, rate, deployer.address, weth.address, parseEther("0.04")
      );
    })
  });

  describe("debt-service repay", () => {
    it("reverts when a user attempts to repay zero", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.repay(weth.address, parseEther("0"))).to.be.revertedWith(
        "INVALID_AMOUNT"
      );
    });

    it("reverts when the exchequer is inactive", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [2 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.repay(weth.address, parseEther("0.05"))).to.be.revertedWith(
        "EXCHEQUER_INACTIVE"
      );
    });

    it("reverts when the user does not have a line of credit", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await expect(polemarch.repay(weth.address, parseEther("0.05"))).to.be.revertedWith(
        "USER_DOES_NOT_HAVE_LINE_OF_CREDIT"
      );
    });

    it("reverts when the expiration date has passed", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await expect(polemarch.repay(weth.address, parseEther("0.05"))).to.be.revertedWith(
        "LINE_OF_CREDIT_EXPIRED"
      );
    });

    it("reverts when the user debt is delinquent", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.05"));
      await ethers.provider.send('evm_increaseTime', [15 * 24 * 60 * 60]);
      await ethers.provider.send('evm_mine');
      await polemarch.markDelinquent(weth.address, deployer.address);
      await expect(polemarch.repay(weth.address, parseEther("0.05"))).to.be.revertedWith(
        "USER_DEBT_IS_DELIQUENT"
      );
    });

    it("emits a repay event", async () => {
      await weth.deposit({ value: parseEther("1.0") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerBorrowing(weth.address, true);
      await polemarch.createLineOfCredit(
        deployer.address, 
        weth.address, 
        parseEther("0.1"), 
        parseEther("0.05"),
        14
      );
      await polemarch.borrow(weth.address, parseEther("0.05"));
      const loc: Types.LineOfCreditStruct = await polemarch.getLineOfCredit(deployer.address);
      await weth.approve(polemarch.address, parseEther("0.05"));
      await expect(polemarch.repay(weth.address, parseEther("0.04")))
        .to.emit(polemarch, "Repay")
        .withArgs(loc.id, deployer.address, weth.address, parseEther("0.04")
      );
    })
  });
});