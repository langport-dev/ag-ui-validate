"""RFC 6902 unit tests, including examples lifted from the RFC's appendix A.
Mirrors js/test/validator/jsonpatch.test.ts.
"""

from __future__ import annotations

import re

import pytest

from ag_ui_validate.protocol.jsonpatch import PatchErr, PatchOk, apply_patch, validate_patch_shape


def test_a1_add_an_object_member():
    r = apply_patch({"foo": "bar"}, [{"op": "add", "path": "/baz", "value": "qux"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": "bar", "baz": "qux"}


def test_a2_add_an_array_element():
    r = apply_patch({"foo": ["bar", "baz"]}, [{"op": "add", "path": "/foo/1", "value": "qux"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": ["bar", "qux", "baz"]}


def test_appends_with_dash():
    r = apply_patch({"foo": ["bar"]}, [{"op": "add", "path": "/foo/-", "value": "baz"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": ["bar", "baz"]}


def test_a3_remove_an_object_member():
    r = apply_patch({"baz": "qux", "foo": "bar"}, [{"op": "remove", "path": "/baz"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": "bar"}


def test_a4_remove_an_array_element():
    r = apply_patch({"foo": ["bar", "qux", "baz"]}, [{"op": "remove", "path": "/foo/1"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": ["bar", "baz"]}


def test_a5_replace_a_value():
    r = apply_patch({"baz": "qux", "foo": "bar"}, [{"op": "replace", "path": "/baz", "value": "boo"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"baz": "boo", "foo": "bar"}


def test_a6_move_a_value():
    r = apply_patch(
        {"foo": {"bar": "baz", "waldo": "fred"}, "qux": {"corge": "grault"}},
        [{"op": "move", "from": "/foo/waldo", "path": "/qux/thud"}],
    )
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": {"bar": "baz"}, "qux": {"corge": "grault", "thud": "fred"}}


def test_a7_move_an_array_element():
    r = apply_patch({"foo": ["all", "grass", "cows", "eat"]}, [{"op": "move", "from": "/foo/1", "path": "/foo/3"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": ["all", "cows", "eat", "grass"]}


def test_a8_a9_test_ops_succeed_and_fail_by_deep_equality():
    ok = apply_patch(
        {"baz": "qux", "foo": ["a", 2, "c"]},
        [{"op": "test", "path": "/baz", "value": "qux"}, {"op": "test", "path": "/foo/1", "value": 2}],
    )
    assert isinstance(ok, PatchOk)
    fail = apply_patch({"baz": "qux"}, [{"op": "test", "path": "/baz", "value": "bar"}])
    assert isinstance(fail, PatchErr)


def test_a10_add_a_nested_member_object():
    r = apply_patch({"foo": "bar"}, [{"op": "add", "path": "/child", "value": {"grandchild": {}}}])
    assert isinstance(r, PatchOk)
    assert r.result == {"foo": "bar", "child": {"grandchild": {}}}


def test_a12_add_to_a_nonexistent_target_fails():
    r = apply_patch({"foo": "bar"}, [{"op": "add", "path": "/baz/bat", "value": "qux"}])
    assert isinstance(r, PatchErr)


def test_a14_tilde_escape_ordering():
    r = apply_patch({"/": 9, "~1": 10}, [{"op": "test", "path": "/~01", "value": 10}])
    assert isinstance(r, PatchOk)


def test_a16_copy():
    r = apply_patch({"baz": ["A"], "bar": 1}, [{"op": "copy", "from": "/baz/0", "path": "/boo"}])
    assert isinstance(r, PatchOk)
    assert r.result == {"baz": ["A"], "bar": 1, "boo": "A"}


def test_replace_on_a_missing_member_fails():
    r = apply_patch({"a": 1}, [{"op": "replace", "path": "/b", "value": 2}])
    assert isinstance(r, PatchErr)
    assert "/b" in r.error


def test_out_of_bounds_array_index_fails():
    r = apply_patch({"items": []}, [{"op": "replace", "path": "/items/3", "value": "x"}])
    assert isinstance(r, PatchErr)


def test_leading_zero_and_non_numeric_array_indices_fail():
    assert isinstance(apply_patch({"a": [1]}, [{"op": "replace", "path": "/a/01", "value": 2}]), PatchErr)
    assert isinstance(apply_patch({"a": [1]}, [{"op": "replace", "path": "/a/x", "value": 2}]), PatchErr)


def test_moving_a_value_into_its_own_child_fails():
    r = apply_patch({"a": {"b": {}}}, [{"op": "move", "from": "/a", "path": "/a/b/c"}])
    assert isinstance(r, PatchErr)


def test_whole_document_replacement_via_empty_pointer():
    r = apply_patch({"a": 1}, [{"op": "replace", "path": "", "value": {"b": 2}}])
    assert isinstance(r, PatchOk)
    assert r.result == {"b": 2}


def test_does_not_mutate_the_input_document():
    doc = {"items": ["a"]}
    apply_patch(doc, [{"op": "add", "path": "/items/-", "value": "b"}])
    assert doc == {"items": ["a"]}


def test_accepts_a_valid_patch():
    assert validate_patch_shape([{"op": "add", "path": "/a", "value": 1}]) is None


@pytest.mark.parametrize(
    "patch,pattern",
    [
        ({"notAnArray": True}, r"array"),
        ([{"path": "/a", "value": 1}], r"op"),
        ([{"op": "merge", "path": "/a", "value": 1}], r"op"),
        ([{"op": "add", "path": "no-slash", "value": 1}], r"path"),
        ([{"op": "add", "path": "/a"}], r"value"),
        ([{"op": "move", "path": "/a"}], r"from"),
        (["not-an-object"], r"object"),
    ],
)
def test_rejects_malformed_patches(patch, pattern):
    problem = validate_patch_shape(patch)
    assert problem is not None
    assert re.search(pattern, problem.error, re.IGNORECASE)
