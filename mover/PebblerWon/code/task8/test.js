import { SuiClient, getFullnodeUrl } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64 } from "@mysten/bcs";
import { bcs } from "@mysten/sui/bcs";
import pkg from "js-sha3";
import { fill_array, check_challege, get_tail } from "./utils.js";
import { consts } from "./constant.js";

const { sha3_256 } = pkg;

// 初始化SUI Client, 用于和主网(mainnet)交互
const suiClient = new SuiClient({ url: getFullnodeUrl("testnet") });
// 从环境变量读取secretKey
const secretKey = "AFof4r1AYwrMtfOoJ8lwU4ewYec9YHC5UQGwXn78nnuE";
/** 这里把base64编码的secretKey转换为字节数组后截掉第一个元素，是因为第一位是一个私钥类型的标记位，后续派生签名者时不需要 **/
const secretKeyBytes = fromBase64(secretKey).slice(1); // 发起方账户私钥
const signer = Ed25519Keypair.fromSecretKey(secretKeyBytes); // 生成签名者
signer.getPublicKey();

function isHashOk(arr, count) {
  for (let i = 0; i < count; ++i) {
    if (arr[i] != 0) {
      return false;
    }
  }
  return true;
}

async function get_challege_bcs() {
  let result = await suiClient.getObject({
    id: consts.challege_object_id,
    options: {
      showContent: true,
      showBcs: true,
    },
  });
  console.log(result);
  let content = result.data.content;
  console.log("content:", content);
  let f = content.fields;
  console.log("difficulty ", f.difficulity);

  let bcs = result.data.bcs;
  console.log("bcs:", bcs);
  return [bcs.bcsBytes, f.difficulity];
}

/**
 * 
  entry fun get_flag(
        proof: vector<u8>,
        github_id,
        challenge: &mut Challenge,
        rand: &Random,
        ctx: &mut TxContext
    )
 * @returns 
 */
async function check_in(proof, github_id) {
  let tx = new Transaction();
  tx.moveCall({
    target: `${consts.ctf_package_id}::lets_move::get_flag`,
    arguments: [
      tx.pure(bcs.vector(bcs.U8).serialize(proof)),
      tx.pure(bcs.string().serialize(github_id).toBytes()),
      tx.object(consts.challege_object_id),
      tx.object("0x8"),
    ],
  });
  tx.setGasBudget(1000000000n);

  console.log(`ready call:${consts.ctf_package_id}::lets_move::get_flag `);

  const result = await suiClient.signAndExecuteTransaction({
    signer: signer,
    transaction: tx,
  });
  console.log("-----------------------\n my hash:", result);

  /**const response = await suiClient.waitForTransaction({
        digest: result.digest,
        options: {
            showEffects: true,
            showEvents: true,
        },
    });
    console.log("wait response:--------------\n",response);
    
    let event = response.events![0].parsedJson as {flag:boolean,github_id:string,sender:string,ture_num:string};*/

  return { transaction_digest: result.digest };
}

/**
 * 
 * let mut full_proof: vector<u8> = vector::empty<u8>();
        vector::append<u8>(&mut full_proof, proof);
        vector::append<u8>(&mut full_proof, tx_context::sender(ctx).to_bytes());
        vector::append<u8>(&mut full_proof, bcs::to_bytes(challenge));

        let hash: vector<u8> = hash::sha3_256(full_proof);

        let mut prefix_sum: u32 = 0;
        let mut i: u64 = 0;
        while (i < challenge.difficulity) {
            prefix_sum = prefix_sum + (*vector::borrow(&hash, i) as u32);
            i = i + 1;
        };
 */

function check() {}

function get_proof(bcs) {
  const buffer = new ArrayBuffer(8);
  let arr = new Uint8Array(buffer);

  return arr;
}

async function test() {
  let [chall_bcs, difficulity] = await get_challege_bcs();
  console.log(chall_bcs);
  let tail = get_tail(chall_bcs);
  console.log("tail length=", tail.length);

  let max_count = 128;
  let start_count = 1;
  let end = 256n;
  //hash  1 bytes means  2 hex char.
  const check_count = 2 * difficulity;

  for (
    let byte_count = start_count;
    byte_count < max_count;
    ++byte_count, end = end * 256n
  ) {
    let merge = new Uint8Array(byte_count + tail.length);
    merge.set(tail, byte_count);

    for (let j = 0n; j < end; ++j) {
      fill_array(merge, j, byte_count);
      //console.log(String(merge));
      let sha3 = sha3_256.create();
      sha3.update(merge);
      let hash = sha3.hex();

      if (check_challege(hash, check_count)) {
        console.log("check_challege :", hash, ",check count:", check_count);
        let proof_arr = merge.slice(0, byte_count);
        console.log("prof_arr:", proof_arr);
        // check_in(proof_arr, "nextuser");
        return;
      }
      //console.log('j,prof_len,merge_len,hash',j,proof_arr.length,merge.length,hash);
    }

    console.log("bytes:", byte_count, ",end=", end, new Date());
  }

  console.log("tail len:", tail.length);
  console.log("tail:", tail);

  //let result = await check_in(proof,'nextuser');
  //return result;
}
// test().then(console.log);

test().then(console.log);
