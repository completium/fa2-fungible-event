import { Bytes, Key, Nat, Option, Or, pair_to_mich, Signature, string_to_mich } from '@completium/archetype-ts-types'
import { blake2b, expect_to_fail, get_account, set_mockup, set_mockup_now, set_quiet } from '@completium/experiment-ts'

// import { get_packed_transfer_params, get_transfer_permit_data, get_missigned_error, wrong_packed_transfer_params, wrong_sig } from './utils'

const assert = require('assert');

/* Contracts */

import { balance_of_request, fa2_fungible_event, operator_key, operator_param, transfer_destination, transfer_param } from './binding/fa2_fungible_event';

/* Accounts ----------------------------------------------------------------- */

const alice = get_account('alice');
const bob   = get_account('bob');
const carl  = get_account('carl');
const user1 = get_account('bootstrap1');
const user2 = get_account('bootstrap2');
const user3 = get_account('bootstrap3');
const user4 = get_account('bootstrap4');

/* Endpoint ---------------------------------------------------------------- */

set_mockup()

/* Verbose mode ------------------------------------------------------------ */

set_quiet(true);

/* Now --------------------------------------------------------------------- */

const now = new Date(Date.now())
set_mockup_now(now)

/* Constants & Utils ------------------------------------------------------- */

const token_id = new Nat(0)
const amount = new Nat(123)
const expiry = new Nat(31556952)

/* Scenarios --------------------------------------------------------------- */

describe('[FA2 fungible] Contracts deployment', async () => {
  it('FA2 fungible contract deployment should succeed', async () => {
    await fa2_fungible_event.deploy(alice.get_address(), { as: alice })
  });
});

describe('[FA2 fungible] Minting', async () => {
  it('Mint tokens as owner for ourself should succeed', async () => {
    const balance_alice_before = await fa2_fungible_event.get_ledger_value(alice.get_address())
    assert(balance_alice_before?.equals(new Nat('123000000000000')), "Invalid amount")

    await fa2_fungible_event.mint(alice.get_address(), new Nat(1000), { as: alice })

    const balance_alice_after = await fa2_fungible_event.get_ledger_value(alice.get_address())
    assert(balance_alice_after?.equals(new Nat('123000000001000')), "Invalid amount")
  });

  it('Mint tokens as non owner for ourself should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.mint(bob.get_address(), new Nat(1000), { as: bob })
    }, fa2_fungible_event.errors.INVALID_CALLER);
  });

  it('Mint tokens as non owner for someone else should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.mint(carl.get_address(), new Nat(1000), { as: bob })
    }, fa2_fungible_event.errors.INVALID_CALLER);
  });

  it('Mint tokens as owner for someone else should succeed', async () => {
    const balance_carl_before = await fa2_fungible_event.get_ledger_value(carl.get_address())
    assert(balance_carl_before == undefined, "Invalid amount")

    await fa2_fungible_event.mint(carl.get_address(), new Nat(1000), { as: alice })

    const balance_carl_after = await fa2_fungible_event.get_ledger_value(carl.get_address())
    assert(balance_carl_after?.equals(new Nat(1000)), "Invalid amount")
  });

  it('Mint token for user 1', async () => {
    const balance_user1_before = await fa2_fungible_event.get_ledger_value(user1.get_address())
    assert(balance_user1_before == undefined, "Invalid amount")

    await fa2_fungible_event.mint(user1.get_address(), new Nat(1), { as: alice })

    const balance_user1_after = await fa2_fungible_event.get_ledger_value(user1.get_address())
    assert(balance_user1_after?.equals(new Nat(1)), "Invalid amount")
  });
});

describe('[FA2 fungible] Update operators', async () => {
  it('Add an operator for ourself should succeed', async () => {
    const op_key = new operator_key(fa2_fungible_event.get_address(), token_id, alice.get_address())
    const has_operator_before = await fa2_fungible_event.has_operator_value(op_key)
    assert(has_operator_before == false)
    await fa2_fungible_event.update_operators([
      Or.Left(new operator_param(alice.get_address(), fa2_fungible_event.get_address(), token_id))
    ], { as : alice })
    const has_operator_after = await fa2_fungible_event.has_operator_value(op_key)
    assert(has_operator_after == true)
  });

  it('Remove a non existing operator should succeed', async () => {
    await fa2_fungible_event.update_operators([
      Or.Right(new operator_param(alice.get_address(), bob.get_address(), token_id))
    ], { as : alice })
  });

  it('Remove an existing operator for another user should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.update_operators([
        Or.Right(new operator_param(alice.get_address(), fa2_fungible_event.get_address(), token_id))
      ], { as : bob })
    }, fa2_fungible_event.errors.CALLER_NOT_OWNER);
  });

  it('Add operator for another user should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.update_operators([
        Or.Left(new operator_param(bob.get_address(), fa2_fungible_event.get_address(), token_id))
      ], { as : alice });
    }, fa2_fungible_event.errors.CALLER_NOT_OWNER);
  });

  it('Remove an existing operator should succeed', async () => {
    const op_key = new operator_key(fa2_fungible_event.get_address(), token_id, alice.get_address())
    const has_operator_before = await fa2_fungible_event.has_operator_value(op_key)
    assert(has_operator_before == true)
    await fa2_fungible_event.update_operators([
      Or.Right(new operator_param(alice.get_address(), fa2_fungible_event.get_address(), token_id))
    ], { as : alice })
    const has_operator_after = await fa2_fungible_event.has_operator_value(op_key)
    assert(has_operator_after == false)
  });
});

describe('[FA2 fungible] Transfers', async () => {
  it('Transfer simple amount of token', async () => {
    const balance_user1_before = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_before?.equals(new Nat(1)), "Invalid amount user 1")
    assert(balance_user2_before == undefined, "Invalid amount user 2")

    await fa2_fungible_event.transfer([new transfer_param(
      user1.get_address(),
      [new transfer_destination(user2.get_address(), token_id, new Nat(1))])],
      { as: user1 }
    );

    const balance_user1_after = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount after user1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount after user2")
  });

  it('Transfer a token from another user without a permit or an operator should fail', async () => {
    const balance_user1_before = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    await expect_to_fail(async () => {
      await fa2_fungible_event.transfer([new transfer_param(
        user1.get_address(),
        [new transfer_destination(user2.get_address(), token_id, new Nat(1))])],
        { as: user2 }
      );
    }, fa2_fungible_event.errors.FA2_NOT_OPERATOR);

    const balance_user1_after = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount after user 1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount after user 2")
  });

  it('Transfer more tokens than owned should fail', async () => {
    const balance_user1_before = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    await expect_to_fail(async () => {
      await fa2_fungible_event.transfer([new transfer_param(
        user1.get_address(),
        [new transfer_destination(user2.get_address(), token_id, new Nat(2))])],
        { as: user1 }
      );
    }, fa2_fungible_event.errors.FA2_INSUFFICIENT_BALANCE);

    const balance_user1_after = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_after == undefined, "Invalid amount after user1")
    assert(balance_user2_after?.equals(new Nat(1)), "Invalid amount after user2")
  });

  it('Transfer tokens with an operator', async () => {
    const balance_user1_before = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_before = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_before == undefined, "Invalid amount user1")
    assert(balance_user2_before?.equals(new Nat(1)), "Invalid amount user2")

    await fa2_fungible_event.update_operators([
      Or.Left<operator_param, operator_param>(new operator_param(user2.get_address(), user3.get_address(), token_id))
      ],
      { as: user2 }
    );

    await fa2_fungible_event.transfer([new transfer_param(
      user2.get_address(),
      [new transfer_destination(user1.get_address(), token_id, new Nat(1))])],
      { as: user3 }
    );

    await fa2_fungible_event.update_operators([
      Or.Right<operator_param, operator_param>(new operator_param(user2.get_address(), user3.get_address(), token_id))
      ],
      { as: user2 }
    );

    const balance_user1_after = await fa2_fungible_event.get_ledger_value(user1.get_address())
    const balance_user2_after = await fa2_fungible_event.get_ledger_value(user2.get_address())
    assert(balance_user1_after?.equals(new Nat(1)), "Invalid amount after user1")
    assert(balance_user2_after == undefined, "Invalid amount after user2")
  });

});

describe('[FA2 fungible] Set metadata', async () => {
  it('Set metadata with empty content should succeed', async () => {
    const metadata_before = await fa2_fungible_event.get_metadata_value("key")
    assert(metadata_before == undefined);

    await fa2_fungible_event.set_metadata("key", Option.Some(new Bytes("")), { as : alice })

    const metadata_after = await fa2_fungible_event.get_metadata_value("key")
    assert(metadata_after?.equals(new Bytes("")));
  });

  it('Set metadata called by not owner should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.set_metadata("key", Option.Some(new Bytes("")), { as : bob })
    }, fa2_fungible_event.errors.INVALID_CALLER);
  });

  it('Set metadata with valid content should succeed', async () => {
    const data = new Bytes('697066733a2f2f516d617635756142437a4d77377871446f55364d444534743473695855484e4737664a68474c746f79774b35694a');
    const metadata_before = await fa2_fungible_event.get_metadata_value("key")
    assert(metadata_before?.equals(new Bytes("")), "Invalid metadata before");

    await fa2_fungible_event.set_metadata("key", Option.Some(data), { as : alice })

    const metadata_after = await fa2_fungible_event.get_metadata_value("key")
    assert(metadata_after?.equals(data));
  });
});

describe('[FA2 fungible] Burn', async () => {
  it('Burn token should succeed', async () => {
    const balance_user1_before = await fa2_fungible_event.get_ledger_value(user1.get_address())
    assert(balance_user1_before?.equals(new Nat(1)), "Invalid amount user1")

    await fa2_fungible_event.burn(new Nat(1), { as: user1 });

    const balance_user1_after = await fa2_fungible_event.get_ledger_value(user1.get_address())
    assert(balance_user1_after === undefined, "Invalid amount")
  });

  it('Burn without tokens should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.burn(new Nat(1), { as: user1 });
    }, fa2_fungible_event.errors.FA2_INSUFFICIENT_BALANCE);
  });

  it('Burn tokens with a partial amount of tokens should succeed', async () => {
    const amount = new Nat(500)
    const balance_user1_before = await fa2_fungible_event.get_ledger_value(carl.get_address())

    await fa2_fungible_event.burn(amount, { as: carl });

    const balance_user1_after = await fa2_fungible_event.get_ledger_value(carl.get_address())
    assert(balance_user1_after?.plus(amount).equals(balance_user1_before ? balance_user1_before : new Nat(0)), "Invalid value")
  });

  it('Burn tokens with more tokens owned should failed', async () => {
    const balance_carl_before = await fa2_fungible_event.get_ledger_value(carl.get_address())
    assert(balance_carl_before?.equals(new Nat(500)), "Invalid amount")

    await expect_to_fail(async () => {
      await fa2_fungible_event.burn(new Nat(1000), { as: carl });
    }, fa2_fungible_event.errors.FA2_INSUFFICIENT_BALANCE);

    const balance_carl_after = await fa2_fungible_event.get_ledger_value(carl.get_address())
    assert(balance_carl_after?.equals(new Nat(500)), "Invalid amount")
  });

});

describe('[FA2 fungible] Pause', async () => {
  it('Set FA2 on pause should succeed', async () => {
    await fa2_fungible_event.pause({ as: alice });
    const is_paused = await fa2_fungible_event.get_paused()
    assert(is_paused);
  });

  it('Minting is not possible when contract is paused should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.mint(alice.get_address(), new Nat(1000), { as : alice })
    }, fa2_fungible_event.errors.CONTRACT_PAUSED);
  });

  it('Update operators is not possible when contract is paused should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.update_operators([
        Or.Left(new operator_param(alice.get_address(), fa2_fungible_event.get_address(), token_id))
      ], { as : alice })
    }, fa2_fungible_event.errors.CONTRACT_PAUSED);
  });

  it('Transfer is not possible when contract is paused should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.transfer([new transfer_param(
        user1.get_address(),
        [new transfer_destination(user2.get_address(), token_id, new Nat(1))])],
        { as: user1 });
    }, fa2_fungible_event.errors.CONTRACT_PAUSED);
  });

  it('Set metadata is not possible when contract is paused should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.set_metadata("key", Option.Some(new Bytes("")), { as : alice })
    }, fa2_fungible_event.errors.CONTRACT_PAUSED);
  });

  it('Burn is not possible when contract is paused should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.burn(new Nat(1), { as : alice })
    }, fa2_fungible_event.errors.CONTRACT_PAUSED);
  });

  it('Unpause by not owner should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.unpause({ as: bob });
    }, fa2_fungible_event.errors.INVALID_CALLER);
  });

});

describe('[FA2 fungible] Transfer ownership', async () => {

  it('Transfer ownership when contract is paused should succeed', async () => {
    const owner = await fa2_fungible_event.get_owner()
    assert(owner.equals(alice.get_address()));
    await fa2_fungible_event.declare_ownership(alice.get_address(), { as: alice });
    const new_owner = await fa2_fungible_event.get_owner()
    assert(owner.equals(new_owner));
  });

  it('Transfer ownership as non owner should fail', async () => {
    await expect_to_fail(async () => {
      await fa2_fungible_event.declare_ownership(bob.get_address(), { as: bob });
    }, fa2_fungible_event.errors.INVALID_CALLER);
  });

  it('Transfer ownership as owner should succeed', async () => {
    const owner = await fa2_fungible_event.get_owner()
    assert(owner.equals(alice.get_address()));
    await fa2_fungible_event.declare_ownership(bob.get_address(), { as: alice })
    await fa2_fungible_event.claim_ownership({ as: bob });
    const new_owner = await fa2_fungible_event.get_owner()
    assert(new_owner.equals(bob.get_address()));
  });
});


describe('[FA2 fungible] Balance of', async () => {

  it('Simple balance of', async () => {
    const balance_alice = await fa2_fungible_event.get_ledger_value(alice.get_address())

    const res = await fa2_fungible_event.balance_of([new balance_of_request(alice.get_address(), token_id)], {})

    assert(res.length == 1)
    assert(balance_alice?.equals(res[0].balance_),              "Invalid balance amount")
    assert(alice.get_address().equals(res[0].request.bo_owner), "Invalid address")
  });

  it('Call balance of with other token id', async () => {
    const other_token_id = new Nat(1)

    const res = await fa2_fungible_event.balance_of([new balance_of_request(alice.get_address(), other_token_id)], {})

    assert(res.length == 1)
    assert((new Nat(0)).equals(res[0].balance_),                "Invalid balance amount")
    assert(alice.get_address().equals(res[0].request.bo_owner), "Invalid address")
  });

  it('Call balance of with unknown address', async () => {
    const res = await fa2_fungible_event.balance_of([new balance_of_request(user4.get_address(), token_id)], {})

    assert(res.length == 1)
    assert((new Nat(0)).equals(res[0].balance_),                "Invalid balance amount")
    assert(user4.get_address().equals(res[0].request.bo_owner), "Invalid address")
  });

});
