#!/usr/bin/perl

# Dependency and makefile management.
# Usage: ./deps.pl FIND_ARGS...
# Result: Generates a makefile based on in-file markup.

# Input files:
#   foo.js:
#     //@ foo.compiled.js --checkTypes=warning
#     import Whatever from './bar';
#   bar.js:
#     import Something from './baz';
#
# Performs a toposort, collecting all deps, and generates deps.d:
#
#   foo.compiled.js: foo.js bar.js deps.d
#     $(JSCOMP) ... --js=foo.js --js=bar.js --js_output_file=foo.compiled.js --checkTypes=warning
#   deps.d: foo.js bar.js
#
# This should be included in the top-level Makefile as:
#
# .PHONY: all
# all: foo.compiled.js
#
# deps.d:
#   ./deps.pl

use strict;
use warnings;

use File::Basename qw/dirname/;

# Find all files recursively from current dir
open FIND, "find . -name '*.js' @ARGV | sed 's+^./++' |";
my @files = <FIND>;
close FIND;
map {chomp $_} @files;

# Scan all the files
my %generated = ();
my %deps = ();
foreach my $file (@files) {
  $deps{$file} = '';
  open JS, $file;
  while (<JS>) {
    if (m|//@\s*(\S+)\s+(.*)|) {
      $generated{$1} = "$file $2";
    } elsif (m|import .* from '(\.\.?/[^']+)'|) {
      my $dep = $1;
      my $dir = dirname $file;
      while ($dep =~ s|^\./|| or $dep =~ s|^\.\./||) {
        $dir = dirname $dir if $& eq '../';
      }
      $dep = "$dir/$dep.js";
      $dep =~ s|^(?:\./)+||;
      $deps{$file} .= " $dep";
    }
  }
  close JS;
}

my $makefile = '';

# Now build up the makefile.
foreach my $out (sort(keys(%generated))) {
  delete $deps{$out};
  # Find all the deps
  my ($file, $flags) = split / /, $generated{$out}, 2;
  my %d = ($file => 1);
  my @q = ($file);
  while (@q) {
    my $cur = shift @q;
    foreach (split / /, ($deps{$cur} or '')) {
      next unless $_;
      next if defined $d{$_};
      $d{$_} = 1;
      push @q, $_;
    }
  }
  # Generate the makefile line
  my $srcmap = $out;
  $srcmap =~ s/\.js$//;
  $srcmap .= ".srcmap";
  my @deps = sort(keys(%d));
  my $header = "$out: @deps deps.d";
  my $cmd = "{ \$(JSCOMP) $flags";
  foreach (@deps) { $cmd .= " --js=$_"; }
  $cmd .= " --create_source_map=$srcmap; echo '//# sourceMappingURL=$srcmap'; } >| $out";
  $makefile .= "$header\n\t$cmd\n\n";
}

my @srcs = sort(keys(%deps));
$makefile .= "deps.d: @srcs\n";

# Now read the existing file if it's there and only update if changed.
if (open DEPS, "deps.d") {
  $/ = undef;
  my $prev = <DEPS>;
  close DEPS;
  exit 0 if $prev eq $makefile;
}

open DEPS, ">deps.d";
print DEPS $makefile;
close DEPS;
