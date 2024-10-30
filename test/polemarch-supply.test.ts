import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";
import { makeLineOfCredit } from "../helpers/contract-helpers";


describe("polemarch-supply", function() {
  let testEnv: TestEnv;

  beforeEach(async () => {
    testEnv = await createTestEnv();
  });
  
  describe("supply-service account-supply", () => {
    
    it("gets the exchequer safe", async () => {
      const { deployer, sWETH } = testEnv;
      const exchequerSafe: string = await sWETH.getExchequerSafe();
      await expect(exchequerSafe).to.equal(deployer.address);
    })

    it("reverts when supply amount is zero", async () => {
      const { polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await expect(polemarch.supply(weth.address, parseEther("0"))).to.be.revertedWith("INVALID_AMOUNT");
    });

    it("reverts supply when exchequer is inactive", async () => {
      const { polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.supply(weth.address, parseEther("0.5"))).to.be.revertedWith(
        "EXCHEQUER_INACTIVE"
      );
    });

    it("reverts when supply is over supplyCap", async () => {
      const { polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.setSupplyCap(weth.address, parseEther("0.25"));
      await expect(polemarch.supply(weth.address, parseEther("0.5"))).to.be.revertedWith(
        "SUPPLY_CAP_EXCEEDED"
      );
    });

    it("emits a supply event", async () => {
      const { deployer, polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.approve(polemarch.address, parseEther("0.5"));
      await expect(polemarch.supply(weth.address, parseEther("0.5")))
        .to.emit(polemarch, "Supply")
        .withArgs(weth.address, deployer.address, parseEther("0.5"));
    });
  });

  describe("supply-service account-withdraw", () => {

    it("reverts when withdraw is zero", async () => {
      const { polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await expect(polemarch.withdraw(weth.address, parseEther("0.0"))).to.be.revertedWith(
        "INVALID_AMOUNT"
      );
    });

    it("reverts when user balance is too low for withdraw", async () => {
      const { polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await expect(polemarch.withdraw(weth.address, parseEther("1.0"))).to.be.revertedWith(
        "USER_BALANCE_TOO_LOW"
      );
    });

    it("successfully withdraws when total debt is larger than the available supply", async () => {
      const borrowerIndex: number = 5;
      let proposalDescription = `Proposal #1: Create a line of credit for User #${borrowerIndex}`;
      const { deployer, users, polemarch, weth, sWETH, dWETH, gWETH, thurmanGov } = testEnv;
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );

      await weth.deposit({ value: parseEther("5.0") });
      await weth.approve(polemarch.address, parseEther("5.0"));
      await polemarch.supply(weth.address, parseEther("5.0"));

      await makeLineOfCredit(testEnv, proposalDescription, "0.5", borrowerIndex, 0, "9.9", "0.2", 14);
      await hre.network.provider.send("hardhat_mine", ["0xB3E2"]);
      await polemarch.connect(users[borrowerIndex]).borrow(weth.address, parseEther("9.9"));

      await expect(polemarch.withdraw(weth.address, parseEther("5.0")))
        .to.emit(polemarch, "Withdraw")
        .withArgs(weth.address, deployer.address, parseEther("5.0"));
    })

    it("reverts withdraw when exchequer is inactive", async () => {
      const { polemarch, weth, sWETH, dWETH, gWETH } = testEnv;
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(
        weth.address, 
        sWETH.address, 
        dWETH.address, 
        gWETH.address, 
        WETH_DECIMALS, 
        parseEther("0.05")
      );
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.withdraw(weth.address, parseEther("0.25"))).to.be.revertedWith(
        "EXCHEQUER_INACTIVE"
      );
    });
  })
})