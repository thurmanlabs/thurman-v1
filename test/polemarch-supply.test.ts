import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { parseEther, formatEther } from "ethers/lib/utils";
import { assert, expect } from "chai";
import { network, deployments, ethers, upgrades } from "hardhat";
import { TestEnv, createTestEnv, WETH_DECIMALS } from "./setup";

describe("polemarch-supply", function() {
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
  
  describe("supply-service account-supply", () => {
    
    it("reverts when supply amount is zero", async () => {
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await expect(polemarch.supply(weth.address, parseEther("0"))).to.be.revertedWith("INVALID_AMOUNT");
    });

    it("reverts supply when exchequer is inactive", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.supply(weth.address, parseEther("0.5"))).to.be.revertedWith(
        "EXCHEQUER_INACTIVE"
      );
    });

    it("reverts when supply is over supplyCap", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.setSupplyCap(weth.address, parseEther("0.25"));
      await expect(polemarch.supply(weth.address, parseEther("0.5"))).to.be.revertedWith(
        "SUPPLY_CAP_EXCEEDED"
      );
    });

    it("emits a supply event", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await expect(polemarch.supply(weth.address, parseEther("0.5")))
        .to.emit(polemarch, "Supply")
        .withArgs(weth.address, deployer.address, parseEther("0.5"));
    });
  });

  describe("supply-service account-withdraw", () => {

    it("reverts when withdraw is zero", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await expect(polemarch.withdraw(weth.address, parseEther("0.0"))).to.be.revertedWith(
        "INVALID_AMOUNT"
      );
    });

    it("reverts when user balance is too low for withdraw", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await expect(polemarch.withdraw(weth.address, parseEther("1.0"))).to.be.revertedWith(
        "USER_BALANCE_TOO_LOW"
      );
    });

    it("reverts withdraw when exchequer is inactive", async () => {
      await weth.deposit({ value: parseEther("0.5") });
      await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
      await weth.approve(polemarch.address, parseEther("0.5"));
      await polemarch.supply(weth.address, parseEther("0.5"));
      await polemarch.setExchequerActive(weth.address, false);
      await expect(polemarch.withdraw(weth.address, parseEther("0.25"))).to.be.revertedWith(
        "EXCHEQUER_INACTIVE"
      );
    });

    it("reverts when user requests to withdraw more than their proportional available supply", 
      async () => {
        await weth.deposit({ value: parseEther("0.5") });
        await polemarch.addExchequer(weth.address, sWETH.address, dWETH.address, WETH_DECIMALS);
        await weth.approve(polemarch.address, parseEther("0.5"));
        await polemarch.supply(weth.address, parseEther("0.5"));
        await polemarch.createLineOfCredit(
          deployer.address,
          weth.address,
          parseEther("0.25"),
          parseEther("0.05"), 
          14
        );
        await expect(polemarch.withdraw(weth.address, parseEther("0.3"))).to.be.revertedWith(
          "WITHDRAWABLE_BALANCE_TOO_LOW"
        );
      }
    )
  })
})