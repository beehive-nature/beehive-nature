pub mod Daedalus {
  #![allow(nonstandard_style)]
  #[allow(unused_imports)]
  use daedalus_rts_rust as ddl;

  #[allow(unused_imports)]
  use ddl::{Type, Clo};

  #[allow(unused_imports)]
  use serde;

  pub(crate) fn _joinWords_371(
    _state: &mut ddl::ParserState,
    fa0: bool,
    fa1: ddl::U<8>,
    fa2: ddl::U<8>,
  ) -> ddl::U<16> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      JoinWords371B0(ddl::U<8>, ddl::U<8>),
      JoinWords371B1(ddl::U<8>, ddl::U<8>),
      JoinWords371B2(bool, ddl::U<8>, ddl::U<8>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::JoinWords371B2(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::JoinWords371B0(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(8, 8, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords371B1(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(8, 8, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords371B2(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::JoinWords371B1(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::JoinWords371B0(_arg_1, _arg_2);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UInt16(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::U<16>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UInt16372B0(ddl::U<16>, ddl::Input),
      UInt16372B2(ddl::Input),
      UInt16372B4(ddl::Input, ddl::U<8>, bool, ddl::U<8>),
      UInt16372B5(ddl::Input),
      UInt16372B6(ddl::Input, ddl::Input, bool, ddl::U<8>),
      UInt16372B8(ddl::Input),
      UInt16372B10(ddl::Input, ddl::U<8>, bool),
      UInt16372B11(ddl::Input),
      UInt16372B12(ddl::Input, ddl::Input, bool),
      UInt16372B13(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UInt16372B13(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::UInt16372B0(_arg_0, _arg_1) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_0, _arg_1)
        },
        Goto::UInt16372B2(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:37--6:41",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16372B4(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          block_id = Goto::UInt16372B0(
            super::Daedalus::_joinWords_371(_state, _arg_2, _arg_3, _arg_1),
            _tmp_0,
          );
          continue '_fun_loop
        },
        Goto::UInt16372B5(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:37--6:41",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16372B6(_arg_1, _arg_0, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::UInt16372B5(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16372B4(_arg_0, _tmp_0, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
        Goto::UInt16372B8(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:31--6:35",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16372B10(_arg_0, _arg_1, _arg_2) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UInt16372B6(_tmp_3, _tmp_0, _arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16372B2(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UInt16372B11(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:6:31--6:35",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt16372B12(_arg_1, _arg_0, _arg_2) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::UInt16372B11(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16372B10(_arg_0, _tmp_0, _arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UInt16372B13(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UInt16372B12(_tmp_1, _arg_0, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UInt16372B8(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn _joinWords_373(
    _state: &mut ddl::ParserState,
    fa0: bool,
    fa1: ddl::U<16>,
    fa2: ddl::U<16>,
  ) -> ddl::U<32> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      JoinWords373B0(ddl::U<16>, ddl::U<16>),
      JoinWords373B1(ddl::U<16>, ddl::U<16>),
      JoinWords373B2(bool, ddl::U<16>, ddl::U<16>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::JoinWords373B2(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::JoinWords373B0(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(16, 16, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords373B1(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(16, 16, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords373B2(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::JoinWords373B1(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::JoinWords373B0(_arg_1, _arg_2);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UInt32(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::U<32>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UInt32374B0(ddl::U<32>, ddl::Input),
      UInt32374B1,
      UInt32374B2(ddl::U<16>, ddl::Input, bool, ddl::U<16>),
      UInt32374B3,
      UInt32374B4(ddl::U<16>, ddl::Input, bool),
      UInt32374B5(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UInt32374B5(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::UInt32374B0(_arg_0, _arg_1) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_0, _arg_1)
        },
        Goto::UInt32374B1 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt32374B2(_arg_0, _arg_1, _arg_2, _arg_3) => {
          block_id = Goto::UInt32374B0(
            super::Daedalus::_joinWords_373(_state, _arg_2, _arg_3, _arg_0),
            _arg_1,
          );
          continue '_fun_loop
        },
        Goto::UInt32374B3 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt32374B4(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./Daedalus.ddl:7:38--7:43:UInt16");
          match super::Daedalus::UInt16(_state, _arg_1, _arg_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt32374B2(x, i, _arg_2, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt32374B1;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::UInt32374B5(_arg_0, _arg_1) => {
          _state.push(false, "./Daedalus.ddl:7:31--7:36:UInt16");
          match super::Daedalus::UInt16(_state, _arg_0, _arg_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt32374B4(x, i, _arg_1);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt32374B3;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn _joinWords_375(
    _state: &mut ddl::ParserState,
    fa0: bool,
    fa1: ddl::U<32>,
    fa2: ddl::U<32>,
  ) -> ddl::U<64> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      JoinWords375B0(ddl::U<32>, ddl::U<32>),
      JoinWords375B1(ddl::U<32>, ddl::U<32>),
      JoinWords375B2(bool, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::JoinWords375B2(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::JoinWords375B0(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(32, 32, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords375B1(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::cat!(32, 32, _arg_0, _arg_1);
          return _tmp_0
        },
        Goto::JoinWords375B2(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::JoinWords375B1(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::JoinWords375B0(_arg_1, _arg_2);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UInt64(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UInt64376B0(ddl::U<64>, ddl::Input),
      UInt64376B1,
      UInt64376B2(ddl::U<32>, ddl::Input, bool, ddl::U<32>),
      UInt64376B3,
      UInt64376B4(ddl::U<32>, ddl::Input, bool),
      UInt64376B5(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UInt64376B5(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::UInt64376B0(_arg_0, _arg_1) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_0, _arg_1)
        },
        Goto::UInt64376B1 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt64376B2(_arg_0, _arg_1, _arg_2, _arg_3) => {
          block_id = Goto::UInt64376B0(
            super::Daedalus::_joinWords_375(_state, _arg_2, _arg_3, _arg_0),
            _arg_1,
          );
          continue '_fun_loop
        },
        Goto::UInt64376B3 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UInt64376B4(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./Daedalus.ddl:8:38--8:43:UInt32");
          match super::Daedalus::UInt32(_state, _arg_1, _arg_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt64376B2(x, i, _arg_2, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt64376B1;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::UInt64376B5(_arg_0, _arg_1) => {
          _state.push(false, "./Daedalus.ddl:8:31--8:36:UInt32");
          match super::Daedalus::UInt32(_state, _arg_0, _arg_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::UInt64376B4(x, i, _arg_1);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::UInt64376B3;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn BEUInt32(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::U<32>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      BEUInt32377B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::BEUInt32377B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::BEUInt32377B0(_arg_0) => {
          _state.push(true, "./Daedalus.ddl:19:50--19:55:UInt32");
          return super::Daedalus::UInt32(_state, _arg_0, true)
        },
      }
    }
  }

  pub(crate) fn BEUInt64(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      BEUInt64378B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::BEUInt64378B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::BEUInt64378B0(_arg_0) => {
          _state.push(true, "./Daedalus.ddl:20:50--20:55:UInt64");
          return super::Daedalus::UInt64(_state, _arg_0, true)
        },
      }
    }
  }

  pub(crate) fn Guard_(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: bool,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Guard379B0(ddl::Input),
      Guard379B1(ddl::Input),
      Guard379B2(ddl::Input, bool),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Guard379B2(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::Guard379B0(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::Guard379B1(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Pattern match failure");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:64:21--64:29",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Guard379B2(_arg_0, _arg_1) => {
          match _arg_1 {
            false => {
              block_id = Goto::Guard379B1(_arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Guard379B0(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }
}

pub mod WB001 {
  #![allow(nonstandard_style)]
  #[allow(unused_imports)]
  use daedalus_rts_rust as ddl;

  #[allow(unused_imports)]
  use ddl::{Type, Clo};

  #[allow(unused_imports)]
  use serde;

  #[derive(Clone, PartialEq, Eq, PartialOrd, Ord)]
  pub struct Envelope {
    pub domain: ddl::Array<ddl::U<8>>,
    pub nonce: ddl::Array<ddl::U<8>>,
    pub epoch: ddl::U<64>,
    pub action: ddl::Array<ddl::U<8>>,
    pub destination: ddl::Array<ddl::U<8>>,
    pub capability: ddl::Array<ddl::U<8>>,
    pub amount: ddl::U<64>,
    pub expiry: ddl::U<64>,
    pub payer: ddl::Array<ddl::U<8>>,
    pub payload: ddl::Array<ddl::U<8>>,
  }

  ddl::serialize_struct!{
    <>, Envelope, (domain, "domain"), (nonce, "nonce"), (epoch, "epoch"), (
      action, "action"
    ), (destination, "destination"), (capability, "capability"), (
      amount, "amount"
    ), (expiry, "expiry"), (payer, "payer"), (payload, "payload")
  }

  ddl::by_ref!{ Envelope }

  pub(crate) fn Header(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Header380B0,
      Header380B1(ddl::Unit, ddl::Input, ddl::U<32>),
      Header380B2(ddl::Input, bool, ddl::U<32>),
      Header380B3(ddl::Input, ddl::U<32>, ddl::U<32>),
      Header380B4(ddl::Input, ddl::U<32>),
      Header380B5,
      Header380B6(ddl::U<32>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header380B8(ddl::Array<ddl::U<8>>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header380B9(ddl::Input, ddl::U<8>),
      Header380B10(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Header380B10(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Header380B0 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header380B1(_arg_0, _arg_1, _arg_2) => {
          let _tmp_0: ddl::U<64> = _arg_2.cast_to();
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Header380B2(_arg_2, _arg_0, _arg_1) => {
          _state.push(false, "./WB001.ddl:46:5--46:29:Guard_");
          match super::Daedalus::Guard_(_state, _arg_2, _arg_0) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Header380B1(x, i, _arg_1);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Header380B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Header380B3(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= _arg_1;
          block_id = Goto::Header380B2(_arg_2, _tmp_0, _arg_0);
          continue '_fun_loop
        },
        Goto::Header380B4(_arg_1, _arg_0) => {
          block_id = Goto::Header380B2(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::Header380B5 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header380B6(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_2 <= _arg_0;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Header380B4(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header380B3(_arg_1, _arg_0, _arg_3);
              continue '_fun_loop
            },
          }
        },
        Goto::Header380B8(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          _state.push(false, "./WB001.ddl:45:13--45:20:BEUInt32");
          match super::Daedalus::BEUInt32(_state, _tmp_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Header380B6(x, i, _arg_2, _arg_3);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Header380B5;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Header380B9(_arg_1, _arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_array([ _arg_0 ]);
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:44:6--44:16",
              _arg_1.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header380B10(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = ddl::new_array([ _arg_1 ]);
          let _tmp_1 = _arg_0.bor().is_prefix(_tmp_0.bor());
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Header380B9(_arg_0, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header380B8(_tmp_0, _arg_0, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn _class_utf8tail(
    _state: &mut ddl::ParserState,
    fa0: ddl::U<8>,
  ) -> bool {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      ByteClassUtf8tail381B0(ddl::U<8>),
      ByteClassUtf8tail381B1,
      ByteClassUtf8tail381B2(ddl::U<8>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::ByteClassUtf8tail381B2(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::ByteClassUtf8tail381B0(_arg_0) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(191u64);
          return _tmp_0
        },
        Goto::ByteClassUtf8tail381B1 => { return false },
        Goto::ByteClassUtf8tail381B2(_arg_0) => {
          let _tmp_0 = <ddl::U<8>>::from(128u64) <= _arg_0;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::ByteClassUtf8tail381B1;
              continue '_fun_loop
            },
            true => {
              block_id = Goto::ByteClassUtf8tail381B0(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn UTF8Char_(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      UTF8Char382B0(ddl::Input),
      UTF8Char382B1(ddl::Input),
      UTF8Char382B2(ddl::Input),
      UTF8Char382B3(ddl::Input),
      UTF8Char382B4(ddl::Input),
      UTF8Char382B5(ddl::Input),
      UTF8Char382B6(ddl::Input),
      UTF8Char382B7(ddl::Input),
      UTF8Char382B8(ddl::Input),
      UTF8Char382B9(ddl::Input),
      UTF8Char382B10(ddl::Input),
      UTF8Char382B11(ddl::Input),
      UTF8Char382B12(ddl::Input),
      UTF8Char382B13(ddl::Input),
      UTF8Char382B14(ddl::Input),
      UTF8Char382B15(ddl::Input),
      UTF8Char382B16(ddl::Input),
      UTF8Char382B17(ddl::Input),
      UTF8Char382B18(ddl::Input),
      UTF8Char382B19(ddl::Input),
      UTF8Char382B20(ddl::Input),
      UTF8Char382B21(ddl::Input),
      UTF8Char382B22(ddl::Input),
      UTF8Char382B23(ddl::Input),
      UTF8Char382B24(ddl::Input),
      UTF8Char382B25(ddl::Input),
      UTF8Char382B26(ddl::Input),
      UTF8Char382B27(ddl::Input),
      UTF8Char382B28(ddl::Input),
      UTF8Char382B29(ddl::Input),
      UTF8Char382B30(ddl::Input),
      UTF8Char382B31(ddl::Input),
      UTF8Char382B32(ddl::Input),
      UTF8Char382B33(ddl::Input),
      UTF8Char382B34(ddl::Input),
      UTF8Char382B35(ddl::Input),
      UTF8Char382B36(ddl::Input),
      UTF8Char382B37(ddl::Input),
      UTF8Char382B38(ddl::Input),
      UTF8Char382B39(ddl::Input),
      UTF8Char382B40(ddl::Input),
      UTF8Char382B41(ddl::Input),
      UTF8Char382B42(ddl::Input),
      UTF8Char382B43(ddl::Input),
      UTF8Char382B44(ddl::Input),
      UTF8Char382B45(ddl::Input),
      UTF8Char382B46(ddl::Input),
      UTF8Char382B47(ddl::Input),
      UTF8Char382B48(ddl::Input),
      UTF8Char382B49(ddl::Input),
      UTF8Char382B50(ddl::Input),
      UTF8Char382B51(ddl::Input),
      UTF8Char382B52(ddl::Input),
      UTF8Char382B53(ddl::Input),
      UTF8Char382B54(ddl::Input),
      UTF8Char382B55(ddl::Input),
      UTF8Char382B56(ddl::Input),
      UTF8Char382B57(ddl::Input),
      UTF8Char382B58(ddl::Input),
      UTF8Char382B59(ddl::Input),
      UTF8Char382B60(ddl::Input),
      UTF8Char382B61(ddl::Input),
      UTF8Char382B62(ddl::Input),
      UTF8Char382B63(ddl::Input),
      UTF8Char382B64(ddl::Input),
      UTF8Char382B65(ddl::Input),
      UTF8Char382B66(ddl::Input),
      UTF8Char382B67(ddl::Input),
      UTF8Char382B68(ddl::Input),
      UTF8Char382B69(ddl::Input),
      UTF8Char382B70(ddl::Input),
      UTF8Char382B71(ddl::Input),
      UTF8Char382B72(ddl::Input),
      UTF8Char382B73(ddl::Input),
      UTF8Char382B74(ddl::Input),
      UTF8Char382B75(ddl::Input),
      UTF8Char382B76(ddl::Input),
      UTF8Char382B77(ddl::Input),
      UTF8Char382B78(ddl::Input),
      UTF8Char382B79(ddl::Input),
      UTF8Char382B80(ddl::Input),
      UTF8Char382B81(ddl::Input),
      UTF8Char382B82(ddl::Input),
      UTF8Char382B83(ddl::Input),
      UTF8Char382B84(ddl::Input),
      UTF8Char382B85(ddl::Input),
      UTF8Char382B86(ddl::Input),
      UTF8Char382B87(ddl::Input),
      UTF8Char382B88(ddl::Input),
      UTF8Char382B89(ddl::Input),
      UTF8Char382B90(ddl::Input),
      UTF8Char382B91(ddl::Input),
      UTF8Char382B92(ddl::Input),
      UTF8Char382B93(ddl::Input),
      UTF8Char382B94(ddl::Input),
      UTF8Char382B95(ddl::Input),
      UTF8Char382B96(ddl::Input),
      UTF8Char382B97(ddl::Input),
      UTF8Char382B98(ddl::Input),
      UTF8Char382B99(ddl::Input),
      UTF8Char382B100(ddl::Input),
      UTF8Char382B101(ddl::Input),
      UTF8Char382B102(ddl::Input),
      UTF8Char382B103(ddl::Input),
      UTF8Char382B104(ddl::Input),
      UTF8Char382B105(ddl::Input),
      UTF8Char382B106(ddl::Input),
      UTF8Char382B107(ddl::Input),
      UTF8Char382B108(ddl::Input),
      UTF8Char382B109(ddl::Input),
      UTF8Char382B110(ddl::Input),
      UTF8Char382B111(ddl::Input),
      UTF8Char382B112(ddl::Input),
      UTF8Char382B113(ddl::Input),
      UTF8Char382B114(ddl::Input),
      UTF8Char382B115(ddl::Input),
      UTF8Char382B116(ddl::Input),
      UTF8Char382B117(ddl::Input),
      UTF8Char382B118(ddl::Input),
      UTF8Char382B119(ddl::Input),
      UTF8Char382B120(ddl::Input),
      UTF8Char382B121(ddl::Input),
      UTF8Char382B122(ddl::Input),
      UTF8Char382B123(ddl::Input),
      UTF8Char382B124(ddl::Input),
      UTF8Char382B125(ddl::Input),
      UTF8Char382B126(ddl::Input),
      UTF8Char382B127(ddl::Input),
      UTF8Char382B128(ddl::Input),
      UTF8Char382B129(ddl::Input),
      UTF8Char382B130(ddl::Input),
      UTF8Char382B131(bool, ddl::Input, ddl::Input),
      UTF8Char382B132(ddl::Input, ddl::Input),
      UTF8Char382B133(ddl::Input),
      UTF8Char382B134(ddl::Input),
      UTF8Char382B135(ddl::Input),
      UTF8Char382B136(ddl::Input),
      UTF8Char382B137(bool, ddl::Input, ddl::Input),
      UTF8Char382B138(ddl::Input, ddl::Input),
      UTF8Char382B139(ddl::Input),
      UTF8Char382B140(ddl::Input),
      UTF8Char382B141(ddl::Input),
      UTF8Char382B142(ddl::Input),
      UTF8Char382B143(bool, ddl::Input, ddl::Input),
      UTF8Char382B144(ddl::Input, ddl::Input),
      UTF8Char382B145(ddl::Input),
      UTF8Char382B146(ddl::Input),
      UTF8Char382B147(ddl::Input),
      UTF8Char382B148(ddl::Input),
      UTF8Char382B149(bool, ddl::Input, ddl::Input),
      UTF8Char382B150(ddl::Input, ddl::Input),
      UTF8Char382B151(ddl::Input),
      UTF8Char382B152(ddl::Input),
      UTF8Char382B153(ddl::Input),
      UTF8Char382B154(ddl::Input),
      UTF8Char382B155(bool, ddl::Input, ddl::Input),
      UTF8Char382B156(ddl::Input, ddl::Input),
      UTF8Char382B157(ddl::Input),
      UTF8Char382B158(ddl::Input),
      UTF8Char382B159(ddl::Input),
      UTF8Char382B160(ddl::Input),
      UTF8Char382B161(bool, ddl::Input, ddl::Input),
      UTF8Char382B162(ddl::Input, ddl::Input),
      UTF8Char382B163(ddl::Input),
      UTF8Char382B164(ddl::Input),
      UTF8Char382B165(ddl::Input),
      UTF8Char382B166(ddl::Input),
      UTF8Char382B167(bool, ddl::Input, ddl::Input),
      UTF8Char382B168(ddl::Input, ddl::Input),
      UTF8Char382B169(ddl::Input),
      UTF8Char382B170(ddl::Input),
      UTF8Char382B171(ddl::Input),
      UTF8Char382B172(ddl::Input),
      UTF8Char382B173(bool, ddl::Input, ddl::Input),
      UTF8Char382B174(ddl::Input, ddl::Input),
      UTF8Char382B175(ddl::Input),
      UTF8Char382B176(ddl::Input),
      UTF8Char382B177(ddl::Input),
      UTF8Char382B178(ddl::Input),
      UTF8Char382B179(bool, ddl::Input, ddl::Input),
      UTF8Char382B180(ddl::Input, ddl::Input),
      UTF8Char382B181(ddl::Input),
      UTF8Char382B182(ddl::Input),
      UTF8Char382B183(ddl::Input),
      UTF8Char382B184(ddl::Input),
      UTF8Char382B185(bool, ddl::Input, ddl::Input),
      UTF8Char382B186(ddl::Input, ddl::Input),
      UTF8Char382B187(ddl::Input),
      UTF8Char382B188(ddl::Input),
      UTF8Char382B189(ddl::Input),
      UTF8Char382B190(ddl::Input),
      UTF8Char382B191(bool, ddl::Input, ddl::Input),
      UTF8Char382B192(ddl::Input, ddl::Input),
      UTF8Char382B193(ddl::Input),
      UTF8Char382B194(ddl::Input),
      UTF8Char382B195(ddl::Input),
      UTF8Char382B196(ddl::Input),
      UTF8Char382B197(bool, ddl::Input, ddl::Input),
      UTF8Char382B198(ddl::Input, ddl::Input),
      UTF8Char382B199(ddl::Input),
      UTF8Char382B200(ddl::Input),
      UTF8Char382B201(ddl::Input),
      UTF8Char382B202(ddl::Input),
      UTF8Char382B203(bool, ddl::Input, ddl::Input),
      UTF8Char382B204(ddl::Input, ddl::Input),
      UTF8Char382B205(ddl::Input),
      UTF8Char382B206(ddl::Input),
      UTF8Char382B207(ddl::Input),
      UTF8Char382B208(ddl::Input),
      UTF8Char382B209(bool, ddl::Input, ddl::Input),
      UTF8Char382B210(ddl::Input, ddl::Input),
      UTF8Char382B211(ddl::Input),
      UTF8Char382B212(ddl::Input),
      UTF8Char382B213(ddl::Input),
      UTF8Char382B214(ddl::Input),
      UTF8Char382B215(bool, ddl::Input, ddl::Input),
      UTF8Char382B216(ddl::Input, ddl::Input),
      UTF8Char382B217(ddl::Input),
      UTF8Char382B218(ddl::Input),
      UTF8Char382B219(ddl::Input),
      UTF8Char382B220(ddl::Input),
      UTF8Char382B221(bool, ddl::Input, ddl::Input),
      UTF8Char382B222(ddl::Input, ddl::Input),
      UTF8Char382B223(ddl::Input),
      UTF8Char382B224(ddl::Input),
      UTF8Char382B225(ddl::Input),
      UTF8Char382B226(ddl::Input),
      UTF8Char382B227(bool, ddl::Input, ddl::Input),
      UTF8Char382B228(ddl::Input, ddl::Input),
      UTF8Char382B229(ddl::Input),
      UTF8Char382B230(ddl::Input),
      UTF8Char382B231(ddl::Input),
      UTF8Char382B232(ddl::Input),
      UTF8Char382B233(bool, ddl::Input, ddl::Input),
      UTF8Char382B234(ddl::Input, ddl::Input),
      UTF8Char382B235(ddl::Input),
      UTF8Char382B236(ddl::Input),
      UTF8Char382B237(ddl::Input),
      UTF8Char382B238(ddl::Input),
      UTF8Char382B239(bool, ddl::Input, ddl::Input),
      UTF8Char382B240(ddl::Input, ddl::Input),
      UTF8Char382B241(ddl::Input),
      UTF8Char382B242(ddl::Input),
      UTF8Char382B243(ddl::Input),
      UTF8Char382B244(ddl::Input),
      UTF8Char382B245(bool, ddl::Input, ddl::Input),
      UTF8Char382B246(ddl::Input, ddl::Input),
      UTF8Char382B247(ddl::Input),
      UTF8Char382B248(ddl::Input),
      UTF8Char382B249(ddl::Input),
      UTF8Char382B250(ddl::Input),
      UTF8Char382B251(bool, ddl::Input, ddl::Input),
      UTF8Char382B252(ddl::Input, ddl::Input),
      UTF8Char382B253(ddl::Input),
      UTF8Char382B254(ddl::Input),
      UTF8Char382B255(ddl::Input),
      UTF8Char382B256(ddl::Input),
      UTF8Char382B257(bool, ddl::Input, ddl::Input),
      UTF8Char382B258(ddl::Input, ddl::Input),
      UTF8Char382B259(ddl::Input),
      UTF8Char382B260(ddl::Input),
      UTF8Char382B261(ddl::Input),
      UTF8Char382B262(ddl::Input),
      UTF8Char382B263(bool, ddl::Input, ddl::Input),
      UTF8Char382B264(ddl::Input, ddl::Input),
      UTF8Char382B265(ddl::Input),
      UTF8Char382B266(ddl::Input),
      UTF8Char382B267(ddl::Input),
      UTF8Char382B268(ddl::Input),
      UTF8Char382B269(bool, ddl::Input, ddl::Input),
      UTF8Char382B270(ddl::Input, ddl::Input),
      UTF8Char382B271(ddl::Input),
      UTF8Char382B272(ddl::Input),
      UTF8Char382B273(ddl::Input),
      UTF8Char382B274(ddl::Input),
      UTF8Char382B275(bool, ddl::Input, ddl::Input),
      UTF8Char382B276(ddl::Input, ddl::Input),
      UTF8Char382B277(ddl::Input),
      UTF8Char382B278(ddl::Input),
      UTF8Char382B279(ddl::Input),
      UTF8Char382B280(ddl::Input),
      UTF8Char382B281(bool, ddl::Input, ddl::Input),
      UTF8Char382B282(ddl::Input, ddl::Input),
      UTF8Char382B283(ddl::Input),
      UTF8Char382B284(ddl::Input),
      UTF8Char382B285(ddl::Input),
      UTF8Char382B286(ddl::Input),
      UTF8Char382B287(bool, ddl::Input, ddl::Input),
      UTF8Char382B288(ddl::Input, ddl::Input),
      UTF8Char382B289(ddl::Input),
      UTF8Char382B290(ddl::Input),
      UTF8Char382B291(ddl::Input),
      UTF8Char382B292(ddl::Input),
      UTF8Char382B293(bool, ddl::Input, ddl::Input),
      UTF8Char382B294(ddl::Input, ddl::Input),
      UTF8Char382B295(ddl::Input),
      UTF8Char382B296(ddl::Input),
      UTF8Char382B297(ddl::Input),
      UTF8Char382B298(ddl::Input),
      UTF8Char382B299(bool, ddl::Input, ddl::Input),
      UTF8Char382B300(ddl::Input, ddl::Input),
      UTF8Char382B301(ddl::Input),
      UTF8Char382B302(ddl::Input),
      UTF8Char382B303(ddl::Input),
      UTF8Char382B304(ddl::Input),
      UTF8Char382B305(bool, ddl::Input, ddl::Input),
      UTF8Char382B306(ddl::Input, ddl::Input),
      UTF8Char382B307(ddl::Input),
      UTF8Char382B308(ddl::Input),
      UTF8Char382B309(ddl::Input),
      UTF8Char382B310(ddl::Input),
      UTF8Char382B311(bool, ddl::Input, ddl::Input),
      UTF8Char382B312(ddl::Input, ddl::Input),
      UTF8Char382B314(ddl::Input),
      UTF8Char382B316(ddl::Input),
      UTF8Char382B317(ddl::Input),
      UTF8Char382B318(ddl::Input, bool, ddl::Input),
      UTF8Char382B319(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char382B320(ddl::Input, ddl::Input),
      UTF8Char382B321(ddl::Input, ddl::Input),
      UTF8Char382B322(ddl::Input),
      UTF8Char382B323(ddl::Input),
      UTF8Char382B324(ddl::Input),
      UTF8Char382B325(ddl::Input),
      UTF8Char382B326(bool, ddl::Input, ddl::Input),
      UTF8Char382B327(ddl::Input, ddl::Input),
      UTF8Char382B329(ddl::Input),
      UTF8Char382B331(ddl::Input),
      UTF8Char382B332(ddl::Input),
      UTF8Char382B333(bool, ddl::Input, ddl::Input),
      UTF8Char382B334(ddl::Input, ddl::Input),
      UTF8Char382B335(ddl::Input),
      UTF8Char382B336(ddl::Input),
      UTF8Char382B337(ddl::Input),
      UTF8Char382B338(ddl::Input),
      UTF8Char382B339(bool, ddl::Input, ddl::Input),
      UTF8Char382B340(ddl::Input, ddl::Input),
      UTF8Char382B342(ddl::Input),
      UTF8Char382B344(ddl::Input),
      UTF8Char382B345(ddl::Input),
      UTF8Char382B346(bool, ddl::Input, ddl::Input),
      UTF8Char382B347(ddl::Input, ddl::Input),
      UTF8Char382B348(ddl::Input),
      UTF8Char382B349(ddl::Input),
      UTF8Char382B350(ddl::Input),
      UTF8Char382B351(ddl::Input),
      UTF8Char382B352(bool, ddl::Input, ddl::Input),
      UTF8Char382B353(ddl::Input, ddl::Input),
      UTF8Char382B355(ddl::Input),
      UTF8Char382B357(ddl::Input),
      UTF8Char382B358(ddl::Input),
      UTF8Char382B359(bool, ddl::Input, ddl::Input),
      UTF8Char382B360(ddl::Input, ddl::Input),
      UTF8Char382B361(ddl::Input),
      UTF8Char382B362(ddl::Input),
      UTF8Char382B363(ddl::Input),
      UTF8Char382B364(ddl::Input),
      UTF8Char382B365(bool, ddl::Input, ddl::Input),
      UTF8Char382B366(ddl::Input, ddl::Input),
      UTF8Char382B368(ddl::Input),
      UTF8Char382B370(ddl::Input),
      UTF8Char382B371(ddl::Input),
      UTF8Char382B372(bool, ddl::Input, ddl::Input),
      UTF8Char382B373(ddl::Input, ddl::Input),
      UTF8Char382B374(ddl::Input),
      UTF8Char382B375(ddl::Input),
      UTF8Char382B376(ddl::Input),
      UTF8Char382B377(ddl::Input),
      UTF8Char382B378(bool, ddl::Input, ddl::Input),
      UTF8Char382B379(ddl::Input, ddl::Input),
      UTF8Char382B381(ddl::Input),
      UTF8Char382B383(ddl::Input),
      UTF8Char382B384(ddl::Input),
      UTF8Char382B385(bool, ddl::Input, ddl::Input),
      UTF8Char382B386(ddl::Input, ddl::Input),
      UTF8Char382B387(ddl::Input),
      UTF8Char382B388(ddl::Input),
      UTF8Char382B389(ddl::Input),
      UTF8Char382B390(ddl::Input),
      UTF8Char382B391(bool, ddl::Input, ddl::Input),
      UTF8Char382B392(ddl::Input, ddl::Input),
      UTF8Char382B394(ddl::Input),
      UTF8Char382B396(ddl::Input),
      UTF8Char382B397(ddl::Input),
      UTF8Char382B398(bool, ddl::Input, ddl::Input),
      UTF8Char382B399(ddl::Input, ddl::Input),
      UTF8Char382B400(ddl::Input),
      UTF8Char382B401(ddl::Input),
      UTF8Char382B402(ddl::Input),
      UTF8Char382B403(ddl::Input),
      UTF8Char382B404(bool, ddl::Input, ddl::Input),
      UTF8Char382B405(ddl::Input, ddl::Input),
      UTF8Char382B407(ddl::Input),
      UTF8Char382B409(ddl::Input),
      UTF8Char382B410(ddl::Input),
      UTF8Char382B411(bool, ddl::Input, ddl::Input),
      UTF8Char382B412(ddl::Input, ddl::Input),
      UTF8Char382B413(ddl::Input),
      UTF8Char382B414(ddl::Input),
      UTF8Char382B415(ddl::Input),
      UTF8Char382B416(ddl::Input),
      UTF8Char382B417(bool, ddl::Input, ddl::Input),
      UTF8Char382B418(ddl::Input, ddl::Input),
      UTF8Char382B420(ddl::Input),
      UTF8Char382B422(ddl::Input),
      UTF8Char382B423(ddl::Input),
      UTF8Char382B424(bool, ddl::Input, ddl::Input),
      UTF8Char382B425(ddl::Input, ddl::Input),
      UTF8Char382B426(ddl::Input),
      UTF8Char382B427(ddl::Input),
      UTF8Char382B428(ddl::Input),
      UTF8Char382B429(ddl::Input),
      UTF8Char382B430(bool, ddl::Input, ddl::Input),
      UTF8Char382B431(ddl::Input, ddl::Input),
      UTF8Char382B433(ddl::Input),
      UTF8Char382B435(ddl::Input),
      UTF8Char382B436(ddl::Input),
      UTF8Char382B437(bool, ddl::Input, ddl::Input),
      UTF8Char382B438(ddl::Input, ddl::Input),
      UTF8Char382B439(ddl::Input),
      UTF8Char382B440(ddl::Input),
      UTF8Char382B441(ddl::Input),
      UTF8Char382B442(ddl::Input),
      UTF8Char382B443(bool, ddl::Input, ddl::Input),
      UTF8Char382B444(ddl::Input, ddl::Input),
      UTF8Char382B446(ddl::Input),
      UTF8Char382B448(ddl::Input),
      UTF8Char382B449(ddl::Input),
      UTF8Char382B450(bool, ddl::Input, ddl::Input),
      UTF8Char382B451(ddl::Input, ddl::Input),
      UTF8Char382B452(ddl::Input),
      UTF8Char382B453(ddl::Input),
      UTF8Char382B454(ddl::Input),
      UTF8Char382B455(ddl::Input),
      UTF8Char382B456(bool, ddl::Input, ddl::Input),
      UTF8Char382B457(ddl::Input, ddl::Input),
      UTF8Char382B459(ddl::Input),
      UTF8Char382B461(ddl::Input),
      UTF8Char382B462(ddl::Input),
      UTF8Char382B463(bool, ddl::Input, ddl::Input),
      UTF8Char382B464(ddl::Input, ddl::Input),
      UTF8Char382B465(ddl::Input),
      UTF8Char382B466(ddl::Input),
      UTF8Char382B467(ddl::Input),
      UTF8Char382B468(ddl::Input),
      UTF8Char382B469(bool, ddl::Input, ddl::Input),
      UTF8Char382B470(ddl::Input, ddl::Input),
      UTF8Char382B472(ddl::Input),
      UTF8Char382B474(ddl::Input),
      UTF8Char382B475(ddl::Input),
      UTF8Char382B476(bool, ddl::Input, ddl::Input),
      UTF8Char382B477(ddl::Input, ddl::Input),
      UTF8Char382B478(ddl::Input),
      UTF8Char382B479(ddl::Input),
      UTF8Char382B480(ddl::Input),
      UTF8Char382B481(ddl::Input),
      UTF8Char382B482(bool, ddl::Input, ddl::Input),
      UTF8Char382B483(ddl::Input, ddl::Input),
      UTF8Char382B485(ddl::Input),
      UTF8Char382B487(ddl::Input),
      UTF8Char382B488(ddl::Input),
      UTF8Char382B489(bool, ddl::Input, ddl::Input),
      UTF8Char382B490(ddl::Input, ddl::Input),
      UTF8Char382B491(ddl::Input),
      UTF8Char382B492(ddl::Input),
      UTF8Char382B493(ddl::Input),
      UTF8Char382B494(ddl::Input),
      UTF8Char382B495(bool, ddl::Input, ddl::Input),
      UTF8Char382B496(ddl::Input, ddl::Input),
      UTF8Char382B498(ddl::Input),
      UTF8Char382B500(ddl::Input),
      UTF8Char382B501(ddl::Input),
      UTF8Char382B502(bool, ddl::Input, ddl::Input),
      UTF8Char382B503(ddl::Input, ddl::Input),
      UTF8Char382B504(ddl::Input),
      UTF8Char382B505(ddl::Input),
      UTF8Char382B506(ddl::Input),
      UTF8Char382B507(ddl::Input),
      UTF8Char382B508(bool, ddl::Input, ddl::Input),
      UTF8Char382B509(ddl::Input, ddl::Input),
      UTF8Char382B511(ddl::Input),
      UTF8Char382B513(ddl::Input),
      UTF8Char382B514(ddl::Input),
      UTF8Char382B515(ddl::Input, bool, ddl::Input),
      UTF8Char382B516(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char382B517(ddl::Input, ddl::Input),
      UTF8Char382B518(ddl::Input, ddl::Input),
      UTF8Char382B519(ddl::Input),
      UTF8Char382B520(ddl::Input),
      UTF8Char382B521(ddl::Input),
      UTF8Char382B522(ddl::Input),
      UTF8Char382B523(bool, ddl::Input, ddl::Input),
      UTF8Char382B524(ddl::Input, ddl::Input),
      UTF8Char382B526(ddl::Input),
      UTF8Char382B528(ddl::Input),
      UTF8Char382B529(ddl::Input),
      UTF8Char382B530(bool, ddl::Input, ddl::Input),
      UTF8Char382B531(ddl::Input, ddl::Input),
      UTF8Char382B533(ddl::Input),
      UTF8Char382B535(ddl::Input),
      UTF8Char382B536(ddl::Input),
      UTF8Char382B537(ddl::Input, bool, ddl::Input),
      UTF8Char382B538(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char382B539(ddl::Input, ddl::Input),
      UTF8Char382B540(ddl::Input, ddl::Input),
      UTF8Char382B541(ddl::Input),
      UTF8Char382B542(ddl::Input),
      UTF8Char382B543(ddl::Input),
      UTF8Char382B544(ddl::Input),
      UTF8Char382B545(bool, ddl::Input, ddl::Input),
      UTF8Char382B546(ddl::Input, ddl::Input),
      UTF8Char382B548(ddl::Input),
      UTF8Char382B550(ddl::Input),
      UTF8Char382B551(ddl::Input),
      UTF8Char382B552(bool, ddl::Input, ddl::Input),
      UTF8Char382B553(ddl::Input, ddl::Input),
      UTF8Char382B555(ddl::Input),
      UTF8Char382B557(ddl::Input),
      UTF8Char382B558(ddl::Input),
      UTF8Char382B559(bool, ddl::Input, ddl::Input),
      UTF8Char382B560(ddl::Input, ddl::Input),
      UTF8Char382B561(ddl::Input),
      UTF8Char382B562(ddl::Input),
      UTF8Char382B563(ddl::Input),
      UTF8Char382B564(ddl::Input),
      UTF8Char382B565(bool, ddl::Input, ddl::Input),
      UTF8Char382B566(ddl::Input, ddl::Input),
      UTF8Char382B568(ddl::Input),
      UTF8Char382B570(ddl::Input),
      UTF8Char382B571(ddl::Input),
      UTF8Char382B572(bool, ddl::Input, ddl::Input),
      UTF8Char382B573(ddl::Input, ddl::Input),
      UTF8Char382B575(ddl::Input),
      UTF8Char382B577(ddl::Input),
      UTF8Char382B578(ddl::Input),
      UTF8Char382B579(bool, ddl::Input, ddl::Input),
      UTF8Char382B580(ddl::Input, ddl::Input),
      UTF8Char382B581(ddl::Input),
      UTF8Char382B582(ddl::Input),
      UTF8Char382B583(ddl::Input),
      UTF8Char382B584(ddl::Input),
      UTF8Char382B585(bool, ddl::Input, ddl::Input),
      UTF8Char382B586(ddl::Input, ddl::Input),
      UTF8Char382B588(ddl::Input),
      UTF8Char382B590(ddl::Input),
      UTF8Char382B591(ddl::Input),
      UTF8Char382B592(bool, ddl::Input, ddl::Input),
      UTF8Char382B593(ddl::Input, ddl::Input),
      UTF8Char382B595(ddl::Input),
      UTF8Char382B597(ddl::Input),
      UTF8Char382B598(ddl::Input),
      UTF8Char382B599(bool, ddl::Input, ddl::Input),
      UTF8Char382B600(ddl::Input, ddl::Input),
      UTF8Char382B601(ddl::Input),
      UTF8Char382B602(ddl::Input),
      UTF8Char382B603(ddl::Input),
      UTF8Char382B604(ddl::Input),
      UTF8Char382B605(bool, ddl::Input, ddl::Input),
      UTF8Char382B606(ddl::Input, ddl::Input),
      UTF8Char382B608(ddl::Input),
      UTF8Char382B610(ddl::Input),
      UTF8Char382B611(ddl::Input),
      UTF8Char382B612(bool, ddl::Input, ddl::Input),
      UTF8Char382B613(ddl::Input, ddl::Input),
      UTF8Char382B615(ddl::Input),
      UTF8Char382B617(ddl::Input),
      UTF8Char382B618(ddl::Input),
      UTF8Char382B619(ddl::Input, bool, ddl::Input),
      UTF8Char382B620(ddl::Input, ddl::U<8>, ddl::Input),
      UTF8Char382B621(ddl::Input, ddl::Input),
      UTF8Char382B622(ddl::Input, ddl::Input),
      UTF8Char382B623(ddl::Input),
      UTF8Char382B624(ddl::Input),
      UTF8Char382B626(ddl::Input),
      UTF8Char382B628(ddl::Input, ddl::U<8>),
      UTF8Char382B629(ddl::Input),
      UTF8Char382B630(ddl::Input, ddl::Input),
      UTF8Char382B631(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::UTF8Char382B631(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::UTF8Char382B0(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B1(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B2(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B3(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B4(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B5(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B6(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B7(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B8(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B9(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B10(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B11(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B12(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B13(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B14(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B15(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B16(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B17(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B18(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B19(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B20(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B21(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B22(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B23(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B24(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B25(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B26(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B27(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B28(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B29(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B30(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B31(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B32(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B33(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B34(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B35(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B36(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B37(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B38(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B39(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B40(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B41(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B42(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B43(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B44(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B45(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B46(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B47(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B48(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B49(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B50(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B51(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B52(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B53(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B54(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B55(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B56(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B57(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B58(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B59(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B60(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B61(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B62(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B63(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B64(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B65(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B66(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B67(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B68(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B69(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B70(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B71(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B72(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B73(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B74(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B75(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B76(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B77(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B78(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B79(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B80(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B81(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B82(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B83(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B84(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B85(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B86(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B87(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B88(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B89(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B90(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B91(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B92(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B93(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B94(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B95(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B96(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B97(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B98(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B99(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B100(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B101(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B102(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B103(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B104(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B105(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B106(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B107(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B108(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B109(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B110(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B111(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B112(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B113(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B114(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B115(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B116(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B117(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B118(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B119(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B120(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B121(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B122(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B123(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B124(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B125(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B126(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B127(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::UTF8Char382B128(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B129(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B130(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B131(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B130(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B129(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B132(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B131(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B133(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B132(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B128(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B134(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B135(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B136(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B137(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B136(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B135(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B138(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B137(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B139(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B138(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B134(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B140(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B141(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B142(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B143(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B142(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B141(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B144(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B143(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B145(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B144(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B140(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B146(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B147(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B148(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B149(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B148(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B147(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B150(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B149(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B151(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B150(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B146(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B152(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B153(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B154(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B155(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B154(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B153(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B156(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B155(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B157(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B156(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B152(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B158(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B159(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B160(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B161(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B160(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B159(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B162(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B161(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B163(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B162(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B158(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B164(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B165(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B166(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B167(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B166(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B165(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B168(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B167(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B169(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B168(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B164(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B170(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B171(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B172(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B173(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B172(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B171(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B174(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B173(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B175(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B174(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B170(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B176(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B177(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B178(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B179(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B178(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B177(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B180(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B179(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B181(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B180(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B176(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B182(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B183(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B184(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B185(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B184(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B183(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B186(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B185(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B187(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B186(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B182(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B188(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B189(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B190(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B191(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B190(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B189(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B192(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B191(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B193(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B192(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B188(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B194(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B195(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B196(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B197(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B196(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B195(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B198(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B197(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B199(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B198(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B194(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B200(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B201(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B202(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B203(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B202(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B201(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B204(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B203(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B205(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B204(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B200(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B206(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B207(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B208(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B209(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B208(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B207(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B210(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B209(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B211(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B210(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B206(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B212(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B213(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B214(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B215(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B214(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B213(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B216(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B215(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B217(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B216(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B212(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B218(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B219(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B220(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B221(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B220(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B219(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B222(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B221(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B223(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B222(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B218(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B224(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B225(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B226(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B227(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B226(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B225(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B228(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B227(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B229(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B228(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B224(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B230(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B231(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B232(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B233(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B232(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B231(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B234(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B233(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B235(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B234(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B230(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B236(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B237(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B238(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B239(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B238(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B237(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B240(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B239(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B241(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B240(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B236(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B242(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B243(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B244(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B245(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B244(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B243(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B246(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B245(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B247(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B246(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B242(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B248(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B249(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B250(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B251(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B250(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B249(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B252(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B251(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B253(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B252(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B248(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B254(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B255(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B256(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B257(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B256(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B255(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B258(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B257(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B259(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B258(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B254(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B260(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B261(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B262(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B263(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B262(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B261(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B264(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B263(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B265(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B264(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B260(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B266(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B267(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B268(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B269(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B268(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B267(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B270(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B269(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B271(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B270(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B266(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B272(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B273(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B274(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B275(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B274(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B273(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B276(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B275(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B277(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B276(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B272(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B278(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B279(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B280(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B281(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B280(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B279(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B282(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B281(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B283(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B282(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B278(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B284(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B285(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B286(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B287(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B286(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B285(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B288(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B287(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B289(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B288(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B284(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B290(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B291(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B292(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B293(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B292(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B291(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B294(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B293(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B295(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B294(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B290(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B296(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B297(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B298(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B299(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B298(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B297(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B300(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B299(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B301(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B300(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B296(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B302(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B303(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B304(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:81:26--81:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B305(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B304(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B303(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B306(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B305(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B307(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B306(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B302(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B308(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:36--82:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B309(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B310(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:36--82:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B311(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B310(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B309(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B312(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B311(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B314(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:18--82:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B316(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B312(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B308(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B317(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:82:18--82:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B318(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B317(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B316(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B319(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(191u64);
          block_id = Goto::UTF8Char382B318(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char382B320(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char382B318(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char382B321(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(160u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B320(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B319(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B322(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B321(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B314(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B323(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B324(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B325(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B326(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B325(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B324(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B327(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B326(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B329(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B331(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B327(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B323(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B332(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B333(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B332(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B331(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B334(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B333(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B335(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B334(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B329(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B336(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B337(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B338(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B339(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B338(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B337(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B340(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B339(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B342(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B344(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B340(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B336(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B345(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B346(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B345(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B344(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B347(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B346(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B348(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B347(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B342(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B349(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B350(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B351(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B352(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B351(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B350(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B353(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B352(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B355(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B357(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B353(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B349(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B358(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B359(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B358(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B357(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B360(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B359(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B361(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B360(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B355(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B362(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B363(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B364(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B365(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B364(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B363(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B366(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B365(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B368(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B370(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B366(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B362(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B371(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B372(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B371(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B370(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B373(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B372(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B374(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B373(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B368(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B375(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B376(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B377(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B378(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B377(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B376(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B379(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B378(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B381(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B383(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B379(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B375(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B384(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B385(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B384(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B383(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B386(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B385(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B387(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B386(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B381(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B388(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B389(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B390(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B391(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B390(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B389(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B392(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B391(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B394(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B396(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B392(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B388(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B397(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B398(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B397(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B396(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B399(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B398(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B400(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B399(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B394(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B401(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B402(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B403(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B404(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B403(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B402(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B405(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B404(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B407(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B409(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B405(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B401(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B410(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B411(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B410(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B409(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B412(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B411(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B413(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B412(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B407(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B414(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B415(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B416(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B417(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B416(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B415(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B418(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B417(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B420(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B422(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B418(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B414(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B423(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B424(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B423(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B422(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B425(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B424(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B426(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B425(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B420(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B427(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B428(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B429(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B430(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B429(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B428(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B431(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B430(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B433(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B435(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B431(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B427(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B436(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B437(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B436(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B435(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B438(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B437(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B439(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B438(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B433(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B440(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B441(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B442(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B443(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B442(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B441(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B444(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B443(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B446(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B448(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B444(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B440(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B449(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B450(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B449(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B448(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B451(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B450(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B452(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B451(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B446(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B453(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B454(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B455(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B456(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B455(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B454(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B457(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B456(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B459(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B461(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B457(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B453(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B462(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B463(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B462(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B461(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B464(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B463(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B465(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B464(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B459(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B466(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B467(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B468(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B469(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B468(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B467(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B470(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B469(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B472(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B474(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B470(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B466(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B475(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B476(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B475(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B474(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B477(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B476(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B478(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B477(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B472(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B479(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B480(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B481(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B482(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B481(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B480(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B483(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B482(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B485(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B487(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B483(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B479(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B488(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B489(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B488(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B487(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B490(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B489(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B491(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B490(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B485(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B492(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B493(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B494(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:56--83:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B495(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B494(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B493(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B496(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B495(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B498(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B500(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B496(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B492(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B501(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:83:41--83:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B502(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B501(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B500(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B503(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B502(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B504(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B503(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B498(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B505(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:36--84:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B506(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B507(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:36--84:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B508(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B507(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B506(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B509(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B508(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B511(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:18--84:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B513(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B509(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B505(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B514(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:84:18--84:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B515(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B514(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B513(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B516(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(159u64);
          block_id = Goto::UTF8Char382B515(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char382B517(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char382B515(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char382B518(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(128u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B517(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B516(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B519(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B518(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B511(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B520(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:51--85:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B521(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B522(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:51--85:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B523(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B522(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B521(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B524(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B523(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B526(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:36--85:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B528(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B524(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B520(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B529(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:36--85:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B530(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B529(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B528(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B531(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B530(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B533(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:18--85:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B535(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B531(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B526(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B536(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:85:18--85:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B537(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B536(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B535(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B538(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(191u64);
          block_id = Goto::UTF8Char382B537(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char382B539(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char382B537(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char382B540(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(144u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B539(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B538(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B541(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B540(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B533(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B542(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B543(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B544(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B545(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B544(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B543(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B546(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B545(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B548(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B550(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B546(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B542(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B551(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B552(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B551(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B550(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B553(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B552(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B555(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B557(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B553(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B548(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B558(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B559(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B558(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B557(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B560(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B559(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B561(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B560(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B555(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B562(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B563(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B564(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B565(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B564(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B563(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B566(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B565(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B568(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B570(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B566(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B562(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B571(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B572(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B571(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B570(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B573(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B572(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B575(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B577(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B573(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B568(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B578(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B579(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B578(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B577(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B580(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B579(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B581(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B580(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B575(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B582(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B583(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B584(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:56--86:67",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B585(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B584(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B583(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B586(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B585(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B588(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B590(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B586(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B582(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B591(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:41--86:52",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B592(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B591(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B590(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B593(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B592(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B595(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B597(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B593(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B588(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B598(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:86:26--86:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B599(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B598(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B597(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B600(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B599(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B601(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B600(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B595(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B602(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:51--87:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B603(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _tmp_0)
        },
        Goto::UTF8Char382B604(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:51--87:62",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B605(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B604(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B603(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B606(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B605(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B608(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:36--87:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B610(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B606(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B602(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B611(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:36--87:47",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B612(_arg_0, _arg_1, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B611(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B610(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B613(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          block_id = Goto::UTF8Char382B612(
            super::WB001::_class_utf8tail(_state, _tmp_0),
            _arg_1,
            _arg_0,
          );
          continue '_fun_loop
        },
        Goto::UTF8Char382B615(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:18--87:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B617(_arg_0) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let _tmp_1 = _tmp_0.bor().is_empty();
          let _tmp_3 = _tmp_0.bor().clo();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B613(_tmp_3, _tmp_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B608(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B618(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:87:18--87:32",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B619(_arg_1, _arg_0, _arg_2) => {
          match _arg_0 {
            false => {
              block_id = Goto::UTF8Char382B618(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B617(_arg_2);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B620(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= <ddl::U<8>>::from(143u64);
          block_id = Goto::UTF8Char382B619(_arg_2, _tmp_0, _arg_1);
          continue '_fun_loop
        },
        Goto::UTF8Char382B621(_arg_1, _arg_0) => {
          block_id = Goto::UTF8Char382B619(_arg_1, false, _arg_0);
          continue '_fun_loop
        },
        Goto::UTF8Char382B622(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          let _tmp_1 = <ddl::U<8>>::from(128u64) <= _tmp_0.bor();
          match _tmp_1.bor() {
            false => {
              block_id = Goto::UTF8Char382B621(_arg_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B620(_arg_1, _tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B623(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B622(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B615(_arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B624(_arg_0) => {
          let _tmp_0: ddl::Array<ddl::U<8>> = ddl::new_byte_array(b"");
          _state
            .note_fail(
              false,
              "DETERMINIZE 1 Fully",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B626(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "DETERMINIZE 1 Fully",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B628(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          match _arg_1.into() {
            0u8 => {
              block_id = Goto::UTF8Char382B0(_tmp_0);
              continue '_fun_loop
            },
            1u8 => {
              block_id = Goto::UTF8Char382B1(_tmp_0);
              continue '_fun_loop
            },
            2u8 => {
              block_id = Goto::UTF8Char382B2(_tmp_0);
              continue '_fun_loop
            },
            3u8 => {
              block_id = Goto::UTF8Char382B3(_tmp_0);
              continue '_fun_loop
            },
            4u8 => {
              block_id = Goto::UTF8Char382B4(_tmp_0);
              continue '_fun_loop
            },
            5u8 => {
              block_id = Goto::UTF8Char382B5(_tmp_0);
              continue '_fun_loop
            },
            6u8 => {
              block_id = Goto::UTF8Char382B6(_tmp_0);
              continue '_fun_loop
            },
            7u8 => {
              block_id = Goto::UTF8Char382B7(_tmp_0);
              continue '_fun_loop
            },
            8u8 => {
              block_id = Goto::UTF8Char382B8(_tmp_0);
              continue '_fun_loop
            },
            9u8 => {
              block_id = Goto::UTF8Char382B9(_tmp_0);
              continue '_fun_loop
            },
            10u8 => {
              block_id = Goto::UTF8Char382B10(_tmp_0);
              continue '_fun_loop
            },
            11u8 => {
              block_id = Goto::UTF8Char382B11(_tmp_0);
              continue '_fun_loop
            },
            12u8 => {
              block_id = Goto::UTF8Char382B12(_tmp_0);
              continue '_fun_loop
            },
            13u8 => {
              block_id = Goto::UTF8Char382B13(_tmp_0);
              continue '_fun_loop
            },
            14u8 => {
              block_id = Goto::UTF8Char382B14(_tmp_0);
              continue '_fun_loop
            },
            15u8 => {
              block_id = Goto::UTF8Char382B15(_tmp_0);
              continue '_fun_loop
            },
            16u8 => {
              block_id = Goto::UTF8Char382B16(_tmp_0);
              continue '_fun_loop
            },
            17u8 => {
              block_id = Goto::UTF8Char382B17(_tmp_0);
              continue '_fun_loop
            },
            18u8 => {
              block_id = Goto::UTF8Char382B18(_tmp_0);
              continue '_fun_loop
            },
            19u8 => {
              block_id = Goto::UTF8Char382B19(_tmp_0);
              continue '_fun_loop
            },
            20u8 => {
              block_id = Goto::UTF8Char382B20(_tmp_0);
              continue '_fun_loop
            },
            21u8 => {
              block_id = Goto::UTF8Char382B21(_tmp_0);
              continue '_fun_loop
            },
            22u8 => {
              block_id = Goto::UTF8Char382B22(_tmp_0);
              continue '_fun_loop
            },
            23u8 => {
              block_id = Goto::UTF8Char382B23(_tmp_0);
              continue '_fun_loop
            },
            24u8 => {
              block_id = Goto::UTF8Char382B24(_tmp_0);
              continue '_fun_loop
            },
            25u8 => {
              block_id = Goto::UTF8Char382B25(_tmp_0);
              continue '_fun_loop
            },
            26u8 => {
              block_id = Goto::UTF8Char382B26(_tmp_0);
              continue '_fun_loop
            },
            27u8 => {
              block_id = Goto::UTF8Char382B27(_tmp_0);
              continue '_fun_loop
            },
            28u8 => {
              block_id = Goto::UTF8Char382B28(_tmp_0);
              continue '_fun_loop
            },
            29u8 => {
              block_id = Goto::UTF8Char382B29(_tmp_0);
              continue '_fun_loop
            },
            30u8 => {
              block_id = Goto::UTF8Char382B30(_tmp_0);
              continue '_fun_loop
            },
            31u8 => {
              block_id = Goto::UTF8Char382B31(_tmp_0);
              continue '_fun_loop
            },
            32u8 => {
              block_id = Goto::UTF8Char382B32(_tmp_0);
              continue '_fun_loop
            },
            33u8 => {
              block_id = Goto::UTF8Char382B33(_tmp_0);
              continue '_fun_loop
            },
            34u8 => {
              block_id = Goto::UTF8Char382B34(_tmp_0);
              continue '_fun_loop
            },
            35u8 => {
              block_id = Goto::UTF8Char382B35(_tmp_0);
              continue '_fun_loop
            },
            36u8 => {
              block_id = Goto::UTF8Char382B36(_tmp_0);
              continue '_fun_loop
            },
            37u8 => {
              block_id = Goto::UTF8Char382B37(_tmp_0);
              continue '_fun_loop
            },
            38u8 => {
              block_id = Goto::UTF8Char382B38(_tmp_0);
              continue '_fun_loop
            },
            39u8 => {
              block_id = Goto::UTF8Char382B39(_tmp_0);
              continue '_fun_loop
            },
            40u8 => {
              block_id = Goto::UTF8Char382B40(_tmp_0);
              continue '_fun_loop
            },
            41u8 => {
              block_id = Goto::UTF8Char382B41(_tmp_0);
              continue '_fun_loop
            },
            42u8 => {
              block_id = Goto::UTF8Char382B42(_tmp_0);
              continue '_fun_loop
            },
            43u8 => {
              block_id = Goto::UTF8Char382B43(_tmp_0);
              continue '_fun_loop
            },
            44u8 => {
              block_id = Goto::UTF8Char382B44(_tmp_0);
              continue '_fun_loop
            },
            45u8 => {
              block_id = Goto::UTF8Char382B45(_tmp_0);
              continue '_fun_loop
            },
            46u8 => {
              block_id = Goto::UTF8Char382B46(_tmp_0);
              continue '_fun_loop
            },
            47u8 => {
              block_id = Goto::UTF8Char382B47(_tmp_0);
              continue '_fun_loop
            },
            48u8 => {
              block_id = Goto::UTF8Char382B48(_tmp_0);
              continue '_fun_loop
            },
            49u8 => {
              block_id = Goto::UTF8Char382B49(_tmp_0);
              continue '_fun_loop
            },
            50u8 => {
              block_id = Goto::UTF8Char382B50(_tmp_0);
              continue '_fun_loop
            },
            51u8 => {
              block_id = Goto::UTF8Char382B51(_tmp_0);
              continue '_fun_loop
            },
            52u8 => {
              block_id = Goto::UTF8Char382B52(_tmp_0);
              continue '_fun_loop
            },
            53u8 => {
              block_id = Goto::UTF8Char382B53(_tmp_0);
              continue '_fun_loop
            },
            54u8 => {
              block_id = Goto::UTF8Char382B54(_tmp_0);
              continue '_fun_loop
            },
            55u8 => {
              block_id = Goto::UTF8Char382B55(_tmp_0);
              continue '_fun_loop
            },
            56u8 => {
              block_id = Goto::UTF8Char382B56(_tmp_0);
              continue '_fun_loop
            },
            57u8 => {
              block_id = Goto::UTF8Char382B57(_tmp_0);
              continue '_fun_loop
            },
            58u8 => {
              block_id = Goto::UTF8Char382B58(_tmp_0);
              continue '_fun_loop
            },
            59u8 => {
              block_id = Goto::UTF8Char382B59(_tmp_0);
              continue '_fun_loop
            },
            60u8 => {
              block_id = Goto::UTF8Char382B60(_tmp_0);
              continue '_fun_loop
            },
            61u8 => {
              block_id = Goto::UTF8Char382B61(_tmp_0);
              continue '_fun_loop
            },
            62u8 => {
              block_id = Goto::UTF8Char382B62(_tmp_0);
              continue '_fun_loop
            },
            63u8 => {
              block_id = Goto::UTF8Char382B63(_tmp_0);
              continue '_fun_loop
            },
            64u8 => {
              block_id = Goto::UTF8Char382B64(_tmp_0);
              continue '_fun_loop
            },
            65u8 => {
              block_id = Goto::UTF8Char382B65(_tmp_0);
              continue '_fun_loop
            },
            66u8 => {
              block_id = Goto::UTF8Char382B66(_tmp_0);
              continue '_fun_loop
            },
            67u8 => {
              block_id = Goto::UTF8Char382B67(_tmp_0);
              continue '_fun_loop
            },
            68u8 => {
              block_id = Goto::UTF8Char382B68(_tmp_0);
              continue '_fun_loop
            },
            69u8 => {
              block_id = Goto::UTF8Char382B69(_tmp_0);
              continue '_fun_loop
            },
            70u8 => {
              block_id = Goto::UTF8Char382B70(_tmp_0);
              continue '_fun_loop
            },
            71u8 => {
              block_id = Goto::UTF8Char382B71(_tmp_0);
              continue '_fun_loop
            },
            72u8 => {
              block_id = Goto::UTF8Char382B72(_tmp_0);
              continue '_fun_loop
            },
            73u8 => {
              block_id = Goto::UTF8Char382B73(_tmp_0);
              continue '_fun_loop
            },
            74u8 => {
              block_id = Goto::UTF8Char382B74(_tmp_0);
              continue '_fun_loop
            },
            75u8 => {
              block_id = Goto::UTF8Char382B75(_tmp_0);
              continue '_fun_loop
            },
            76u8 => {
              block_id = Goto::UTF8Char382B76(_tmp_0);
              continue '_fun_loop
            },
            77u8 => {
              block_id = Goto::UTF8Char382B77(_tmp_0);
              continue '_fun_loop
            },
            78u8 => {
              block_id = Goto::UTF8Char382B78(_tmp_0);
              continue '_fun_loop
            },
            79u8 => {
              block_id = Goto::UTF8Char382B79(_tmp_0);
              continue '_fun_loop
            },
            80u8 => {
              block_id = Goto::UTF8Char382B80(_tmp_0);
              continue '_fun_loop
            },
            81u8 => {
              block_id = Goto::UTF8Char382B81(_tmp_0);
              continue '_fun_loop
            },
            82u8 => {
              block_id = Goto::UTF8Char382B82(_tmp_0);
              continue '_fun_loop
            },
            83u8 => {
              block_id = Goto::UTF8Char382B83(_tmp_0);
              continue '_fun_loop
            },
            84u8 => {
              block_id = Goto::UTF8Char382B84(_tmp_0);
              continue '_fun_loop
            },
            85u8 => {
              block_id = Goto::UTF8Char382B85(_tmp_0);
              continue '_fun_loop
            },
            86u8 => {
              block_id = Goto::UTF8Char382B86(_tmp_0);
              continue '_fun_loop
            },
            87u8 => {
              block_id = Goto::UTF8Char382B87(_tmp_0);
              continue '_fun_loop
            },
            88u8 => {
              block_id = Goto::UTF8Char382B88(_tmp_0);
              continue '_fun_loop
            },
            89u8 => {
              block_id = Goto::UTF8Char382B89(_tmp_0);
              continue '_fun_loop
            },
            90u8 => {
              block_id = Goto::UTF8Char382B90(_tmp_0);
              continue '_fun_loop
            },
            91u8 => {
              block_id = Goto::UTF8Char382B91(_tmp_0);
              continue '_fun_loop
            },
            92u8 => {
              block_id = Goto::UTF8Char382B92(_tmp_0);
              continue '_fun_loop
            },
            93u8 => {
              block_id = Goto::UTF8Char382B93(_tmp_0);
              continue '_fun_loop
            },
            94u8 => {
              block_id = Goto::UTF8Char382B94(_tmp_0);
              continue '_fun_loop
            },
            95u8 => {
              block_id = Goto::UTF8Char382B95(_tmp_0);
              continue '_fun_loop
            },
            96u8 => {
              block_id = Goto::UTF8Char382B96(_tmp_0);
              continue '_fun_loop
            },
            97u8 => {
              block_id = Goto::UTF8Char382B97(_tmp_0);
              continue '_fun_loop
            },
            98u8 => {
              block_id = Goto::UTF8Char382B98(_tmp_0);
              continue '_fun_loop
            },
            99u8 => {
              block_id = Goto::UTF8Char382B99(_tmp_0);
              continue '_fun_loop
            },
            100u8 => {
              block_id = Goto::UTF8Char382B100(_tmp_0);
              continue '_fun_loop
            },
            101u8 => {
              block_id = Goto::UTF8Char382B101(_tmp_0);
              continue '_fun_loop
            },
            102u8 => {
              block_id = Goto::UTF8Char382B102(_tmp_0);
              continue '_fun_loop
            },
            103u8 => {
              block_id = Goto::UTF8Char382B103(_tmp_0);
              continue '_fun_loop
            },
            104u8 => {
              block_id = Goto::UTF8Char382B104(_tmp_0);
              continue '_fun_loop
            },
            105u8 => {
              block_id = Goto::UTF8Char382B105(_tmp_0);
              continue '_fun_loop
            },
            106u8 => {
              block_id = Goto::UTF8Char382B106(_tmp_0);
              continue '_fun_loop
            },
            107u8 => {
              block_id = Goto::UTF8Char382B107(_tmp_0);
              continue '_fun_loop
            },
            108u8 => {
              block_id = Goto::UTF8Char382B108(_tmp_0);
              continue '_fun_loop
            },
            109u8 => {
              block_id = Goto::UTF8Char382B109(_tmp_0);
              continue '_fun_loop
            },
            110u8 => {
              block_id = Goto::UTF8Char382B110(_tmp_0);
              continue '_fun_loop
            },
            111u8 => {
              block_id = Goto::UTF8Char382B111(_tmp_0);
              continue '_fun_loop
            },
            112u8 => {
              block_id = Goto::UTF8Char382B112(_tmp_0);
              continue '_fun_loop
            },
            113u8 => {
              block_id = Goto::UTF8Char382B113(_tmp_0);
              continue '_fun_loop
            },
            114u8 => {
              block_id = Goto::UTF8Char382B114(_tmp_0);
              continue '_fun_loop
            },
            115u8 => {
              block_id = Goto::UTF8Char382B115(_tmp_0);
              continue '_fun_loop
            },
            116u8 => {
              block_id = Goto::UTF8Char382B116(_tmp_0);
              continue '_fun_loop
            },
            117u8 => {
              block_id = Goto::UTF8Char382B117(_tmp_0);
              continue '_fun_loop
            },
            118u8 => {
              block_id = Goto::UTF8Char382B118(_tmp_0);
              continue '_fun_loop
            },
            119u8 => {
              block_id = Goto::UTF8Char382B119(_tmp_0);
              continue '_fun_loop
            },
            120u8 => {
              block_id = Goto::UTF8Char382B120(_tmp_0);
              continue '_fun_loop
            },
            121u8 => {
              block_id = Goto::UTF8Char382B121(_tmp_0);
              continue '_fun_loop
            },
            122u8 => {
              block_id = Goto::UTF8Char382B122(_tmp_0);
              continue '_fun_loop
            },
            123u8 => {
              block_id = Goto::UTF8Char382B123(_tmp_0);
              continue '_fun_loop
            },
            124u8 => {
              block_id = Goto::UTF8Char382B124(_tmp_0);
              continue '_fun_loop
            },
            125u8 => {
              block_id = Goto::UTF8Char382B125(_tmp_0);
              continue '_fun_loop
            },
            126u8 => {
              block_id = Goto::UTF8Char382B126(_tmp_0);
              continue '_fun_loop
            },
            127u8 => {
              block_id = Goto::UTF8Char382B127(_tmp_0);
              continue '_fun_loop
            },
            194u8 => {
              block_id = Goto::UTF8Char382B133(_tmp_0);
              continue '_fun_loop
            },
            195u8 => {
              block_id = Goto::UTF8Char382B139(_tmp_0);
              continue '_fun_loop
            },
            196u8 => {
              block_id = Goto::UTF8Char382B145(_tmp_0);
              continue '_fun_loop
            },
            197u8 => {
              block_id = Goto::UTF8Char382B151(_tmp_0);
              continue '_fun_loop
            },
            198u8 => {
              block_id = Goto::UTF8Char382B157(_tmp_0);
              continue '_fun_loop
            },
            199u8 => {
              block_id = Goto::UTF8Char382B163(_tmp_0);
              continue '_fun_loop
            },
            200u8 => {
              block_id = Goto::UTF8Char382B169(_tmp_0);
              continue '_fun_loop
            },
            201u8 => {
              block_id = Goto::UTF8Char382B175(_tmp_0);
              continue '_fun_loop
            },
            202u8 => {
              block_id = Goto::UTF8Char382B181(_tmp_0);
              continue '_fun_loop
            },
            203u8 => {
              block_id = Goto::UTF8Char382B187(_tmp_0);
              continue '_fun_loop
            },
            204u8 => {
              block_id = Goto::UTF8Char382B193(_tmp_0);
              continue '_fun_loop
            },
            205u8 => {
              block_id = Goto::UTF8Char382B199(_tmp_0);
              continue '_fun_loop
            },
            206u8 => {
              block_id = Goto::UTF8Char382B205(_tmp_0);
              continue '_fun_loop
            },
            207u8 => {
              block_id = Goto::UTF8Char382B211(_tmp_0);
              continue '_fun_loop
            },
            208u8 => {
              block_id = Goto::UTF8Char382B217(_tmp_0);
              continue '_fun_loop
            },
            209u8 => {
              block_id = Goto::UTF8Char382B223(_tmp_0);
              continue '_fun_loop
            },
            210u8 => {
              block_id = Goto::UTF8Char382B229(_tmp_0);
              continue '_fun_loop
            },
            211u8 => {
              block_id = Goto::UTF8Char382B235(_tmp_0);
              continue '_fun_loop
            },
            212u8 => {
              block_id = Goto::UTF8Char382B241(_tmp_0);
              continue '_fun_loop
            },
            213u8 => {
              block_id = Goto::UTF8Char382B247(_tmp_0);
              continue '_fun_loop
            },
            214u8 => {
              block_id = Goto::UTF8Char382B253(_tmp_0);
              continue '_fun_loop
            },
            215u8 => {
              block_id = Goto::UTF8Char382B259(_tmp_0);
              continue '_fun_loop
            },
            216u8 => {
              block_id = Goto::UTF8Char382B265(_tmp_0);
              continue '_fun_loop
            },
            217u8 => {
              block_id = Goto::UTF8Char382B271(_tmp_0);
              continue '_fun_loop
            },
            218u8 => {
              block_id = Goto::UTF8Char382B277(_tmp_0);
              continue '_fun_loop
            },
            219u8 => {
              block_id = Goto::UTF8Char382B283(_tmp_0);
              continue '_fun_loop
            },
            220u8 => {
              block_id = Goto::UTF8Char382B289(_tmp_0);
              continue '_fun_loop
            },
            221u8 => {
              block_id = Goto::UTF8Char382B295(_tmp_0);
              continue '_fun_loop
            },
            222u8 => {
              block_id = Goto::UTF8Char382B301(_tmp_0);
              continue '_fun_loop
            },
            223u8 => {
              block_id = Goto::UTF8Char382B307(_tmp_0);
              continue '_fun_loop
            },
            224u8 => {
              block_id = Goto::UTF8Char382B322(_tmp_0);
              continue '_fun_loop
            },
            225u8 => {
              block_id = Goto::UTF8Char382B335(_tmp_0);
              continue '_fun_loop
            },
            226u8 => {
              block_id = Goto::UTF8Char382B348(_tmp_0);
              continue '_fun_loop
            },
            227u8 => {
              block_id = Goto::UTF8Char382B361(_tmp_0);
              continue '_fun_loop
            },
            228u8 => {
              block_id = Goto::UTF8Char382B374(_tmp_0);
              continue '_fun_loop
            },
            229u8 => {
              block_id = Goto::UTF8Char382B387(_tmp_0);
              continue '_fun_loop
            },
            230u8 => {
              block_id = Goto::UTF8Char382B400(_tmp_0);
              continue '_fun_loop
            },
            231u8 => {
              block_id = Goto::UTF8Char382B413(_tmp_0);
              continue '_fun_loop
            },
            232u8 => {
              block_id = Goto::UTF8Char382B426(_tmp_0);
              continue '_fun_loop
            },
            233u8 => {
              block_id = Goto::UTF8Char382B439(_tmp_0);
              continue '_fun_loop
            },
            234u8 => {
              block_id = Goto::UTF8Char382B452(_tmp_0);
              continue '_fun_loop
            },
            235u8 => {
              block_id = Goto::UTF8Char382B465(_tmp_0);
              continue '_fun_loop
            },
            236u8 => {
              block_id = Goto::UTF8Char382B478(_tmp_0);
              continue '_fun_loop
            },
            237u8 => {
              block_id = Goto::UTF8Char382B519(_tmp_0);
              continue '_fun_loop
            },
            238u8 => {
              block_id = Goto::UTF8Char382B491(_tmp_0);
              continue '_fun_loop
            },
            239u8 => {
              block_id = Goto::UTF8Char382B504(_tmp_0);
              continue '_fun_loop
            },
            240u8 => {
              block_id = Goto::UTF8Char382B541(_tmp_0);
              continue '_fun_loop
            },
            241u8 => {
              block_id = Goto::UTF8Char382B561(_tmp_0);
              continue '_fun_loop
            },
            242u8 => {
              block_id = Goto::UTF8Char382B581(_tmp_0);
              continue '_fun_loop
            },
            243u8 => {
              block_id = Goto::UTF8Char382B601(_tmp_0);
              continue '_fun_loop
            },
            244u8 => {
              block_id = Goto::UTF8Char382B623(_tmp_0);
              continue '_fun_loop
            },
            _ => {
              block_id = Goto::UTF8Char382B624(_tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B629(_arg_0) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "DETERMINIZE 1 Fully",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::UTF8Char382B630(_arg_1, _arg_0) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::UTF8Char382B629(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B628(_arg_0, _tmp_0);
              continue '_fun_loop
            },
          }
        },
        Goto::UTF8Char382B631(_arg_0) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::UTF8Char382B630(_tmp_1, _arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::UTF8Char382B626(_arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn _ManyBody_459(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      ManyBody459B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::ManyBody459B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::ManyBody459B0(_arg_0) => {
          _state.push(true, "./WB001.ddl:54:44--54:51:UTF8Char_");
          return super::WB001::UTF8Char_(_state, _arg_0)
        },
      }
    }
  }

  enum __CallRec460<'result> {
    Many460(
      ddl::Input,
      &'result mut std::mem::MaybeUninit<ddl::ParserResult<ddl::Unit>>,
    ),
  }

  fn __call_rec460<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec460<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany460(
        &'result mut std::mem::MaybeUninit<ddl::ParserResult<ddl::Unit>>,
      ),
    }
    enum Goto {
      Many460B0(ddl::Input),
      Many460B1(ddl::Input),
      Many460B2(bool, ddl::Input),
      Many460B4(ddl::Input),
      Many460B5(ddl::Unit, ddl::Input),
      Many460B6(ddl::Input),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec460::Many460(fa0, __result) => {
          __stack.push(Frame::DoneMany460(__result));
          Goto::Many460B6(fa0)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many460B0(_arg_0) => {
          _state.push(true, ":Many_460");
          block_id = Goto::Many460B6(_arg_0);
          continue '_fun_loop
        },
        Goto::Many460B1(_arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany460(__output) => {
              __output.write(ddl::ParserResult::Ok(ddl::Unit, _arg_0));
              return;
            },
          }
        },
        Goto::Many460B2(_arg_0, _arg_1) => {
          match _arg_0 {
            false => {
              block_id = Goto::Many460B1(_arg_1);
              continue '_fun_loop
            },
            true => { block_id = Goto::Many460B0(_arg_1); continue '_fun_loop },
          }
        },
        Goto::Many460B4(_arg_0) => {
          block_id = Goto::Many460B2(false, _arg_0);
          continue '_fun_loop
        },
        Goto::Many460B5(_arg_0, _arg_1) => {
          block_id = Goto::Many460B2(true, _arg_1);
          continue '_fun_loop
        },
        Goto::Many460B6(_arg_0) => {
          _state.push(false, ":ManyBody_459");
          let _tmp_0 = _arg_0.bor().clo();
          match super::WB001::_ManyBody_459(_state, _tmp_0) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Many460B5(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Many460B4(_arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              match __stack.into_iter().next().unwrap() {
                Frame::DoneMany460(__output) => {
                  __output.write(ddl::ParserResult::Exception);
                  return;
                },
              }
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_460(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result: std::mem::MaybeUninit<ddl::ParserResult<ddl::Unit>> =
      std::mem::MaybeUninit::uninit();
    __call_rec460(_state, __CallRec460::Many460(fa0, &mut __result));
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn _Only__383(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Only383B0(ddl::Input),
      Only383B1(ddl::Input),
      Only383B2,
      Only383B3(ddl::Unit, ddl::Input),
      Only383B4(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Only383B4(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::Only383B0(_arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_0)
        },
        Goto::Only383B1(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected leftover input");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:78:35--78:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Only383B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Only383B3(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_1.bor().is_empty();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Only383B1(_arg_1);
              continue '_fun_loop
            },
            true => { block_id = Goto::Only383B0(_arg_1); continue '_fun_loop },
          }
        },
        Goto::Only383B4(_arg_0) => {
          _state.push(false, "./Daedalus.ddl:78:32--78:32:Many_460");
          match super::WB001::_Many_460(_state, _arg_0) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Only383B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Only383B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn _LookAhead__384(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      LookAhead384B0,
      LookAhead384B1(ddl::Unit, ddl::Input, ddl::Input),
      LookAhead384B2(ddl::Input, ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::LookAhead384B2(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::LookAhead384B0 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::LookAhead384B1(_arg_0, _arg_1, _arg_2) => {
          _state.pop();
          return ddl::ParserResult::Ok(ddl::Unit, _arg_2)
        },
        Goto::LookAhead384B2(_arg_0, _arg_1) => {
          _state.push(false, "./Daedalus.ddl:138:7--138:7:Only__383");
          match super::WB001::_Only__383(_state, _arg_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::LookAhead384B1(x, i, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::LookAhead384B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn _WithStream__385(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::Input,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      WithStream385B0(ddl::Input, ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::WithStream385B0(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::WithStream385B0(_arg_0, _arg_1) => {
          _state.push(true, "./Daedalus.ddl:135:3--145:3:LookAhead__384");
          return super::WB001::_LookAhead__384(_state, _arg_0, _arg_1)
        },
      }
    }
  }

  enum __CallRec462<'result> {
    Many462(
      ddl::Input,
      ddl::U<64>,
      ddl::Builder<ddl::U<8>>,
      ddl::U<64>,
      &'result mut std::mem::MaybeUninit<
        ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
      >,
    ),
  }

  fn __call_rec462<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec462<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany462(
        &'result mut std::mem::MaybeUninit<
          ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
        >,
      ),
    }
    enum Goto {
      Many462B0(
        ddl::U<64>,
        ddl::Input,
        ddl::Builder<ddl::U<8>>,
        ddl::U<8>,
        ddl::U<64>,
      ),
      Many462B1,
      Many462B4(ddl::Input),
      Many462B6(ddl::Input, ddl::Input),
      Many462B9(
        ddl::Input,
        ddl::U<8>,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many462B10(ddl::Input, ddl::Input),
      Many462B11(
        ddl::Input,
        ddl::Input,
        ddl::Input,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many462B12(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
      Many462B13(ddl::Input, ddl::Builder<ddl::U<8>>),
      Many462B14(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec462::Many462(fa0, fa1, fa2, fa3, __result) => {
          __stack.push(Frame::DoneMany462(__result));
          Goto::Many462B14(fa0, fa1, fa2, fa3)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many462B0(_arg_0, _arg_4, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1.push(_arg_2);
          _state.push(true, ":Many_462");
          block_id = Goto::Many462B14(_arg_4, _arg_0, _tmp_0, _arg_3);
          continue '_fun_loop
        },
        Goto::Many462B1 => {
          _state.set_exception("", "addition out of bounds");
          match __stack.into_iter().next().unwrap() {
            Frame::DoneMany462(__output) => {
              __output.write(ddl::ParserResult::Exception);
              return;
            },
          }
        },
        Goto::Many462B4(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"insufficient element occurances");
          _state.note_fail(false, "", _arg_0.bor(), _tmp_0.bor());
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany462(__output) => {
              __output.write(ddl::ParserResult::Failure);
              return;
            },
          }
        },
        Goto::Many462B6(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:53:20--53:24",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many462B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many462B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let (_tmp_2, _tmp_1) = _arg_2.op_add(<ddl::U<64>>::from(1u64));
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Many462B0(
                _tmp_2,
                _tmp_0,
                _arg_3,
                _arg_1,
                _arg_4,
              );
              continue '_fun_loop
            },
            true => { block_id = Goto::Many462B1; continue '_fun_loop },
          }
        },
        Goto::Many462B10(_arg_0, _arg_1) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:53:20--53:24",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many462B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many462B11(_arg_2, _arg_0, _arg_1, _arg_3, _arg_4, _arg_5) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::Many462B10(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many462B9(
                _arg_0,
                _tmp_0,
                _arg_3,
                _arg_4,
                _arg_5,
              );
              continue '_fun_loop
            },
          }
        },
        Goto::Many462B12(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          let _tmp_2 = _arg_0.bor().clo();
          let _tmp_5 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many462B11(
                _tmp_1,
                _tmp_2,
                _arg_0,
                _arg_1,
                _arg_2,
                _arg_3,
              );
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many462B6(_tmp_5, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::Many462B13(_arg_1, _arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany462(__output) => {
              __output.write(ddl::ParserResult::Ok(_arg_0, _arg_1));
              return;
            },
          }
        },
        Goto::Many462B14(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1 < _arg_3;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many462B13(_arg_0, _arg_2);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many462B12(_arg_0, _arg_1, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_462(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<64>,
    fa2: ddl::Builder<ddl::U<8>>,
    fa3: ddl::U<64>,
  ) -> ddl::ParserResult<ddl::Builder<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result:
      std::mem::MaybeUninit<ddl::ParserResult<ddl::Builder<ddl::U<8>>>> =
      std::mem::MaybeUninit::uninit();
    __call_rec462(
      _state,
      __CallRec462::Many462(fa0, fa1, fa2, fa3, &mut __result),
    );
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn Text(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Array<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Text386B0,
      Text386B1(ddl::Unit, ddl::Input, ddl::Array<ddl::U<8>>),
      Text386B2,
      Text386B3(ddl::Builder<ddl::U<8>>, ddl::Input),
      Text386B4,
      Text386B5(ddl::U<64>, ddl::Input),
      Text386B6(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Text386B6(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Text386B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Text386B1(_arg_0, _arg_1, _arg_2) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_2, _arg_1)
        },
        Goto::Text386B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Text386B3(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.build();
          let _tmp_1 = ddl::new_byte_array(b"array");
          let _tmp_5 = _tmp_0.bor().clo();
          let _tmp_2 = ddl::new_input(_tmp_1, _tmp_5);
          _state.push(false, "./WB001.ddl:54:5--54:51:WithStream__385");
          match super::WB001::_WithStream__385(_state, _arg_1, _tmp_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Text386B1(x, i, _tmp_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Text386B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Text386B4 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Text386B5(_arg_0, _arg_1) => {
          let _tmp_0: ddl::Builder<ddl::U<8>> = ddl::new_builder();
          _state.push(false, "./WB001.ddl:53:13--53:24:Many_462");
          match super::WB001::_Many_462(
            _state,
            _arg_1,
            <ddl::U<64>>::from(0u64),
            _tmp_0,
            _arg_0,
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Text386B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Text386B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Text386B6(_arg_0, _arg_1, _arg_2, _arg_3) => {
          _state.push(false, "./WB001.ddl:52:13--52:28:Header");
          match super::WB001::Header(_state, _arg_0, _arg_1, _arg_2, _arg_3) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Text386B5(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Text386B4;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  enum __CallRec469<'result> {
    Many469(
      ddl::Input,
      ddl::U<64>,
      ddl::Builder<ddl::U<8>>,
      ddl::U<64>,
      &'result mut std::mem::MaybeUninit<
        ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
      >,
    ),
  }

  fn __call_rec469<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec469<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany469(
        &'result mut std::mem::MaybeUninit<
          ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
        >,
      ),
    }
    enum Goto {
      Many469B0(
        ddl::U<64>,
        ddl::Input,
        ddl::Builder<ddl::U<8>>,
        ddl::U<8>,
        ddl::U<64>,
      ),
      Many469B1,
      Many469B4(ddl::Input),
      Many469B6(ddl::Input, ddl::Input),
      Many469B9(
        ddl::Input,
        ddl::U<8>,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many469B10(ddl::Input, ddl::Input),
      Many469B11(
        ddl::Input,
        ddl::Input,
        ddl::Input,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many469B12(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
      Many469B13(ddl::Input, ddl::Builder<ddl::U<8>>),
      Many469B14(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec469::Many469(fa0, fa1, fa2, fa3, __result) => {
          __stack.push(Frame::DoneMany469(__result));
          Goto::Many469B14(fa0, fa1, fa2, fa3)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many469B0(_arg_0, _arg_4, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1.push(_arg_2);
          _state.push(true, ":Many_469");
          block_id = Goto::Many469B14(_arg_4, _arg_0, _tmp_0, _arg_3);
          continue '_fun_loop
        },
        Goto::Many469B1 => {
          _state.set_exception("", "addition out of bounds");
          match __stack.into_iter().next().unwrap() {
            Frame::DoneMany469(__output) => {
              __output.write(ddl::ParserResult::Exception);
              return;
            },
          }
        },
        Goto::Many469B4(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"insufficient element occurances");
          _state.note_fail(false, "", _arg_0.bor(), _tmp_0.bor());
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany469(__output) => {
              __output.write(ddl::ParserResult::Failure);
              return;
            },
          }
        },
        Goto::Many469B6(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:61:12--61:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many469B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many469B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let (_tmp_2, _tmp_1) = _arg_2.op_add(<ddl::U<64>>::from(1u64));
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Many469B0(
                _tmp_2,
                _tmp_0,
                _arg_3,
                _arg_1,
                _arg_4,
              );
              continue '_fun_loop
            },
            true => { block_id = Goto::Many469B1; continue '_fun_loop },
          }
        },
        Goto::Many469B10(_arg_0, _arg_1) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:61:12--61:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many469B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many469B11(_arg_2, _arg_0, _arg_1, _arg_3, _arg_4, _arg_5) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::Many469B10(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many469B9(
                _arg_0,
                _tmp_0,
                _arg_3,
                _arg_4,
                _arg_5,
              );
              continue '_fun_loop
            },
          }
        },
        Goto::Many469B12(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          let _tmp_2 = _arg_0.bor().clo();
          let _tmp_5 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many469B11(
                _tmp_1,
                _tmp_2,
                _arg_0,
                _arg_1,
                _arg_2,
                _arg_3,
              );
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many469B6(_tmp_5, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::Many469B13(_arg_1, _arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany469(__output) => {
              __output.write(ddl::ParserResult::Ok(_arg_0, _arg_1));
              return;
            },
          }
        },
        Goto::Many469B14(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1 < _arg_3;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many469B13(_arg_0, _arg_2);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many469B12(_arg_0, _arg_1, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_469(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<64>,
    fa2: ddl::Builder<ddl::U<8>>,
    fa3: ddl::U<64>,
  ) -> ddl::ParserResult<ddl::Builder<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result:
      std::mem::MaybeUninit<ddl::ParserResult<ddl::Builder<ddl::U<8>>>> =
      std::mem::MaybeUninit::uninit();
    __call_rec469(
      _state,
      __CallRec469::Many469(fa0, fa1, fa2, fa3, &mut __result),
    );
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn Fixed(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Array<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Fixed387B0,
      Fixed387B1(ddl::Builder<ddl::U<8>>, ddl::Input),
      Fixed387B2,
      Fixed387B3(ddl::U<64>, ddl::Input),
      Fixed387B4(ddl::Input, ddl::U<8>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Fixed387B4(fa0, fa1, fa2);
    '_fun_loop: loop {
      match block_id {
        Goto::Fixed387B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Fixed387B1(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.build();
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Fixed387B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Fixed387B3(_arg_0, _arg_1) => {
          let _tmp_0: ddl::Builder<ddl::U<8>> = ddl::new_builder();
          _state.push(false, "./WB001.ddl:61:5--61:16:Many_469");
          match super::WB001::_Many_469(
            _state,
            _arg_1,
            <ddl::U<64>>::from(0u64),
            _tmp_0,
            _arg_0,
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Fixed387B1(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Fixed387B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Fixed387B4(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./WB001.ddl:60:13--60:32:Header");
          match super::WB001::Header(_state, _arg_0, _arg_1, _arg_2, _arg_2) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Fixed387B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Fixed387B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  enum __CallRec476<'result> {
    Many476(
      ddl::Input,
      ddl::U<64>,
      ddl::Builder<ddl::U<8>>,
      ddl::U<64>,
      &'result mut std::mem::MaybeUninit<
        ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
      >,
    ),
  }

  fn __call_rec476<'result>(
    _state: &mut ddl::ParserState,
    __entry: __CallRec476<'result>,
  ) -> () {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Frame<'result> {
      DoneMany476(
        &'result mut std::mem::MaybeUninit<
          ddl::ParserResult<ddl::Builder<ddl::U<8>>>,
        >,
      ),
    }
    enum Goto {
      Many476B0(
        ddl::U<64>,
        ddl::Input,
        ddl::Builder<ddl::U<8>>,
        ddl::U<8>,
        ddl::U<64>,
      ),
      Many476B1,
      Many476B4(ddl::Input),
      Many476B6(ddl::Input, ddl::Input),
      Many476B9(
        ddl::Input,
        ddl::U<8>,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many476B10(ddl::Input, ddl::Input),
      Many476B11(
        ddl::Input,
        ddl::Input,
        ddl::Input,
        ddl::U<64>,
        ddl::Builder<ddl::U<8>>,
        ddl::U<64>,
      ),
      Many476B12(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
      Many476B13(ddl::Input, ddl::Builder<ddl::U<8>>),
      Many476B14(ddl::Input, ddl::U<64>, ddl::Builder<ddl::U<8>>, ddl::U<64>),
    }
    let mut __stack: Vec<Frame<'result>> = Vec::new();
    let mut block_id =
      match __entry {
        __CallRec476::Many476(fa0, fa1, fa2, fa3, __result) => {
          __stack.push(Frame::DoneMany476(__result));
          Goto::Many476B14(fa0, fa1, fa2, fa3)
        },
      };
    '_fun_loop: loop {
      match block_id {
        Goto::Many476B0(_arg_0, _arg_4, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1.push(_arg_2);
          _state.push(true, ":Many_476");
          block_id = Goto::Many476B14(_arg_4, _arg_0, _tmp_0, _arg_3);
          continue '_fun_loop
        },
        Goto::Many476B1 => {
          _state.set_exception("", "addition out of bounds");
          match __stack.into_iter().next().unwrap() {
            Frame::DoneMany476(__output) => {
              __output.write(ddl::ParserResult::Exception);
              return;
            },
          }
        },
        Goto::Many476B4(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"insufficient element occurances");
          _state.note_fail(false, "", _arg_0.bor(), _tmp_0.bor());
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany476(__output) => {
              __output.write(ddl::ParserResult::Failure);
              return;
            },
          }
        },
        Goto::Many476B6(_arg_0, _arg_1) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected end of input");
          _state
            .note_fail(
              false,
              "./WB001.ddl:67:12--67:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many476B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many476B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          let _tmp_0 = _arg_0.advance(<usize>::from(<ddl::U<64>>::from(1u64)));
          let (_tmp_2, _tmp_1) = _arg_2.op_add(<ddl::U<64>>::from(1u64));
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Many476B0(
                _tmp_2,
                _tmp_0,
                _arg_3,
                _arg_1,
                _arg_4,
              );
              continue '_fun_loop
            },
            true => { block_id = Goto::Many476B1; continue '_fun_loop },
          }
        },
        Goto::Many476B10(_arg_0, _arg_1) => {
          let _tmp_0 =
            ddl::new_byte_array(b"Byte does not match specification");
          _state
            .note_fail(
              false,
              "./WB001.ddl:67:12--67:16",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          block_id = Goto::Many476B4(_arg_1);
          continue '_fun_loop
        },
        Goto::Many476B11(_arg_2, _arg_0, _arg_1, _arg_3, _arg_4, _arg_5) => {
          let _tmp_0 = _arg_0.bor().head();
          match true {
            false => {
              block_id = Goto::Many476B10(_arg_2, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many476B9(
                _arg_0,
                _tmp_0,
                _arg_3,
                _arg_4,
                _arg_5,
              );
              continue '_fun_loop
            },
          }
        },
        Goto::Many476B12(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_0.bor().is_empty();
          let _tmp_1 = _arg_0.bor().clo();
          let _tmp_2 = _arg_0.bor().clo();
          let _tmp_5 = _arg_0.bor().clo();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many476B11(
                _tmp_1,
                _tmp_2,
                _arg_0,
                _arg_1,
                _arg_2,
                _arg_3,
              );
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many476B6(_tmp_5, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::Many476B13(_arg_1, _arg_0) => {
          _state.pop();
          match __stack.pop().unwrap() {
            Frame::DoneMany476(__output) => {
              __output.write(ddl::ParserResult::Ok(_arg_0, _arg_1));
              return;
            },
          }
        },
        Goto::Many476B14(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_1 < _arg_3;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Many476B13(_arg_0, _arg_2);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Many476B12(_arg_0, _arg_1, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  #[inline(always)]
  pub(crate) fn _Many_476(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<64>,
    fa2: ddl::Builder<ddl::U<8>>,
    fa3: ddl::U<64>,
  ) -> ddl::ParserResult<ddl::Builder<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    let mut __result:
      std::mem::MaybeUninit<ddl::ParserResult<ddl::Builder<ddl::U<8>>>> =
      std::mem::MaybeUninit::uninit();
    __call_rec476(
      _state,
      __CallRec476::Many476(fa0, fa1, fa2, fa3, &mut __result),
    );
    return unsafe { __result.assume_init() }
  }

  pub(crate) fn Raw(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Array<ddl::U<8>>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Raw388B0,
      Raw388B1(ddl::Builder<ddl::U<8>>, ddl::Input),
      Raw388B2,
      Raw388B3(ddl::U<64>, ddl::Input),
      Raw388B4(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Raw388B4(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Raw388B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Raw388B1(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_0.build();
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Raw388B2 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Raw388B3(_arg_0, _arg_1) => {
          let _tmp_0: ddl::Builder<ddl::U<8>> = ddl::new_builder();
          _state.push(false, "./WB001.ddl:67:5--67:16:Many_476");
          match super::WB001::_Many_476(
            _state,
            _arg_1,
            <ddl::U<64>>::from(0u64),
            _tmp_0,
            _arg_0,
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Raw388B1(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Raw388B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Raw388B4(_arg_0, _arg_1, _arg_2, _arg_3) => {
          _state.push(false, "./WB001.ddl:66:13--66:28:Header");
          match super::WB001::Header(_state, _arg_0, _arg_1, _arg_2, _arg_3) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Raw388B3(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Raw388B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub(crate) fn Header_(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
    fa2: ddl::U<32>,
    fa3: ddl::U<32>,
  ) -> ddl::ParserResult<ddl::Unit> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Header389B0(ddl::Input, bool),
      Header389B1(ddl::Input, ddl::U<32>, ddl::U<32>),
      Header389B2(ddl::Input),
      Header389B3,
      Header389B4(ddl::U<32>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header389B6(ddl::Array<ddl::U<8>>, ddl::Input, ddl::U<32>, ddl::U<32>),
      Header389B7(ddl::Input, ddl::U<8>),
      Header389B8(ddl::Input, ddl::U<8>, ddl::U<32>, ddl::U<32>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Header389B8(fa0, fa1, fa2, fa3);
    '_fun_loop: loop {
      match block_id {
        Goto::Header389B0(_arg_1, _arg_0) => {
          _state.push(true, "./WB001.ddl:46:5--46:29:Guard_");
          return super::Daedalus::Guard_(_state, _arg_1, _arg_0)
        },
        Goto::Header389B1(_arg_2, _arg_0, _arg_1) => {
          let _tmp_0 = _arg_0 <= _arg_1;
          block_id = Goto::Header389B0(_arg_2, _tmp_0);
          continue '_fun_loop
        },
        Goto::Header389B2(_arg_0) => {
          block_id = Goto::Header389B0(_arg_0, false);
          continue '_fun_loop
        },
        Goto::Header389B3 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header389B4(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = _arg_2 <= _arg_0;
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Header389B2(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header389B1(_arg_1, _arg_0, _arg_3);
              continue '_fun_loop
            },
          }
        },
        Goto::Header389B6(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          _state.push(false, "./WB001.ddl:45:13--45:20:BEUInt32");
          match super::Daedalus::BEUInt32(_state, _tmp_1) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Header389B4(x, i, _arg_2, _arg_3);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Header389B3;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Header389B7(_arg_1, _arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_array([ _arg_0 ]);
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:44:6--44:16",
              _arg_1.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Header389B8(_arg_0, _arg_1, _arg_2, _arg_3) => {
          let _tmp_0 = ddl::new_array([ _arg_1 ]);
          let _tmp_1 = _arg_0.bor().is_prefix(_tmp_0.bor());
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Header389B7(_arg_0, _arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Header389B6(_tmp_0, _arg_0, _arg_2, _arg_3);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn Word(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
    fa1: ddl::U<8>,
  ) -> ddl::ParserResult<ddl::U<64>> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Word390B0,
      Word390B1(ddl::Unit, ddl::Input),
      Word390B2(ddl::Input, ddl::U<8>),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Word390B2(fa0, fa1);
    '_fun_loop: loop {
      match block_id {
        Goto::Word390B0 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Word390B1(_arg_0, _arg_1) => {
          _state.push(true, "./WB001.ddl:73:5--73:12:BEUInt64");
          return super::Daedalus::BEUInt64(_state, _arg_1)
        },
        Goto::Word390B2(_arg_0, _arg_1) => {
          _state.push(false, "./WB001.ddl:72:5--72:18:Header_");
          match super::WB001::Header_(
            _state,
            _arg_0,
            _arg_1,
            <ddl::U<32>>::from(8u64),
            <ddl::U<32>>::from(8u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Word390B1(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Word390B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub fn Envelope(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<super::WB001::Envelope> {
    enum Goto {
      Envelope391B0,
      Envelope391B1(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope391B2,
      Envelope391B3(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::U<64>,
      ),
      Envelope391B4,
      Envelope391B5(
        ddl::U<64>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
      ),
      Envelope391B6,
      Envelope391B7(
        ddl::U<64>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope391B8,
      Envelope391B9(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope391B10,
      Envelope391B11(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope391B12,
      Envelope391B13(
        ddl::Array<ddl::U<8>>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
        ddl::U<64>,
      ),
      Envelope391B14,
      Envelope391B15(
        ddl::U<64>,
        ddl::Input,
        ddl::Array<ddl::U<8>>,
        ddl::Array<ddl::U<8>>,
      ),
      Envelope391B16,
      Envelope391B17(ddl::Array<ddl::U<8>>, ddl::Input, ddl::Array<ddl::U<8>>),
      Envelope391B18,
      Envelope391B19(ddl::Array<ddl::U<8>>, ddl::Input),
      Envelope391B21(ddl::Array<ddl::U<8>>, ddl::Input),
      Envelope391B22(ddl::Input),
      Envelope391B24(ddl::Array<ddl::U<8>>, ddl::Input),
      Envelope391B25(ddl::Input),
      Envelope391B26(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Envelope391B26(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::Envelope391B0 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B1(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7, _arg_8, _arg_9, _arg_10) => {
          let _tmp_0 =
            super::WB001::Envelope {
              domain: _arg_2,
              nonce: _arg_3,
              epoch: _arg_4,
              action: _arg_5,
              destination: _arg_6,
              capability: _arg_7,
              amount: _arg_8,
              expiry: _arg_9,
              payer: _arg_10,
              payload: _arg_0,
            };
          _state.pop();
          return ddl::ParserResult::Ok(_tmp_0, _arg_1)
        },
        Goto::Envelope391B2 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B3(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7, _arg_8, _arg_9) => {
          _state.push(false, "./WB001.ddl:36:19--36:33:Raw");
          match super::WB001::Raw(
            _state,
            _arg_1,
            <ddl::U<8>>::from(10u64),
            <ddl::U<32>>::from(0u64),
            <ddl::U<32>>::from(4096u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B1(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_7,
                _arg_8,
                _arg_9,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B0;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B4 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B5(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7, _arg_8) => {
          _state.push(false, "./WB001.ddl:35:19--35:33:Text");
          match super::WB001::Text(
            _state,
            _arg_1,
            <ddl::U<8>>::from(9u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(128u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B3(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_7,
                _arg_8,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B2;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B6 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B7(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6, _arg_7) => {
          _state.push(false, "./WB001.ddl:34:19--34:27:Word");
          match super::WB001::Word(_state, _arg_1, <ddl::U<8>>::from(8u64)) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B5(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_7,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B4;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B8 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B9(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5, _arg_6) => {
          _state.push(false, "./WB001.ddl:33:19--33:27:Word");
          match super::WB001::Word(_state, _arg_1, <ddl::U<8>>::from(7u64)) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B7(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_6,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B6;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B10 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B11(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4, _arg_5) => {
          _state.push(false, "./WB001.ddl:32:19--32:32:Text");
          match super::WB001::Text(
            _state,
            _arg_1,
            <ddl::U<8>>::from(6u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(64u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B9(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_5,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B8;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B12 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B13(_arg_0, _arg_1, _arg_2, _arg_3, _arg_4) => {
          _state.push(false, "./WB001.ddl:31:19--31:33:Text");
          match super::WB001::Text(
            _state,
            _arg_1,
            <ddl::U<8>>::from(5u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(128u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B11(
                x,
                i,
                _arg_2,
                _arg_3,
                _arg_4,
                _arg_0,
              );
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B10;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B14 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B15(_arg_0, _arg_1, _arg_2, _arg_3) => {
          _state.push(false, "./WB001.ddl:30:19--30:31:Fixed");
          match super::WB001::Fixed(
            _state,
            _arg_1,
            <ddl::U<8>>::from(4u64),
            <ddl::U<32>>::from(32u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B13(x, i, _arg_2, _arg_3, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B12;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B16 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B17(_arg_0, _arg_1, _arg_2) => {
          _state.push(false, "./WB001.ddl:29:19--29:27:Word");
          match super::WB001::Word(_state, _arg_1, <ddl::U<8>>::from(3u64)) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B15(x, i, _arg_2, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B14;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B18 => {
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B19(_arg_0, _arg_1) => {
          _state.push(false, "./WB001.ddl:28:19--28:31:Fixed");
          match super::WB001::Fixed(
            _state,
            _arg_1,
            <ddl::U<8>>::from(2u64),
            <ddl::U<32>>::from(32u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B17(x, i, _arg_0);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B16;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B21(_arg_0, _arg_1) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          _state.push(false, "./WB001.ddl:27:19--27:32:Text");
          match super::WB001::Text(
            _state,
            _tmp_1,
            <ddl::U<8>>::from(1u64),
            <ddl::U<32>>::from(1u64),
            <ddl::U<32>>::from(65u64),
          ) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Envelope391B19(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Envelope391B18;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
        Goto::Envelope391B22(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_array([ <ddl::U<8>>::from(1u64) ]);
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:26:5--26:16",
              _arg_0.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B24(_arg_0, _arg_1) => {
          let _tmp_0 = <ddl::U<64>>::from(_arg_0.bor().len());
          let _tmp_1 = _arg_1.advance(<usize>::from(_tmp_0.bor()));
          let _tmp_2 = ddl::new_array([ <ddl::U<8>>::from(1u64) ]);
          let _tmp_3 = _tmp_1.bor().is_prefix(_tmp_2.bor());
          match _tmp_3.bor() {
            false => {
              block_id = Goto::Envelope391B22(_tmp_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Envelope391B21(_tmp_2, _tmp_1);
              continue '_fun_loop
            },
          }
        },
        Goto::Envelope391B25(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Expected ");
          let _tmp_1 = ddl::new_byte_array(b"bT-WB01");
          let _tmp_2 = ddl::new_array([ _tmp_0, _tmp_1 ]);
          let _tmp_3 = _tmp_2.bor().concat();
          _state
            .note_fail(
              false,
              "./WB001.ddl:25:5--25:19",
              _arg_0.bor(),
              _tmp_3.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Envelope391B26(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"bT-WB01");
          let _tmp_1 = _arg_0.bor().is_prefix(_tmp_0.bor());
          match _tmp_1.bor() {
            false => {
              block_id = Goto::Envelope391B25(_arg_0);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Envelope391B24(_tmp_0, _arg_0);
              continue '_fun_loop
            },
          }
        },
      }
    }
  }

  pub(crate) fn _Only_392(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<super::WB001::Envelope> {
    #![allow(unused)]
    #![allow(nonstandard_style)]
    enum Goto {
      Only392B1(ddl::Input, super::WB001::Envelope),
      Only392B2(ddl::Input),
      Only392B3,
      Only392B4(super::WB001::Envelope, ddl::Input),
      Only392B5(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Only392B5(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::Only392B1(_arg_1, _arg_0) => {
          _state.pop();
          return ddl::ParserResult::Ok(_arg_0, _arg_1)
        },
        Goto::Only392B2(_arg_0) => {
          let _tmp_0 = ddl::new_byte_array(b"Unexpected leftover input");
          _state
            .note_fail(
              false,
              "./Daedalus.ddl:78:35--78:37",
              _arg_0.bor(),
              _tmp_0.bor(),
            );
          _state.pop();
          return ddl::ParserResult::Failure
        },
        Goto::Only392B3 => { _state.pop(); return ddl::ParserResult::Failure },
        Goto::Only392B4(_arg_0, _arg_1) => {
          let _tmp_0 = _arg_1.bor().is_empty();
          match _tmp_0.bor() {
            false => {
              block_id = Goto::Only392B2(_arg_1);
              continue '_fun_loop
            },
            true => {
              block_id = Goto::Only392B1(_arg_1, _arg_0);
              continue '_fun_loop
            },
          }
        },
        Goto::Only392B5(_arg_0) => {
          _state.push(false, "./Daedalus.ddl:78:32--78:32:Envelope");
          match super::WB001::Envelope(_state, _arg_0) {
            ddl::ParserResult::Ok(x, i) => {
              block_id = Goto::Only392B4(x, i);
              continue '_fun_loop
            },
            ddl::ParserResult::Failure => {
              block_id = Goto::Only392B3;
              continue '_fun_loop
            },
            ddl::ParserResult::Exception => {
              return ddl::ParserResult::Exception
            },
          }
        },
      }
    }
  }

  pub fn Exact(
    _state: &mut ddl::ParserState,
    fa0: ddl::Input,
  ) -> ddl::ParserResult<super::WB001::Envelope> {
    enum Goto {
      Exact393B0(ddl::Input),
    }
    #[allow(unused_mut)]
    let mut block_id = Goto::Exact393B0(fa0);
    '_fun_loop: loop {
      match block_id {
        Goto::Exact393B0(_arg_0) => {
          _state.push(true, "./WB001.ddl:39:13--39:25:Only_392");
          return super::WB001::_Only_392(_state, _arg_0)
        },
      }
    }
  }
}