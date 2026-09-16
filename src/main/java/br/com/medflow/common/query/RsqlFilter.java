package br.com.medflow.common.query;

import cz.jirutka.rsql.parser.RSQLParser;
import cz.jirutka.rsql.parser.ast.AndNode;
import cz.jirutka.rsql.parser.ast.ComparisonNode;
import cz.jirutka.rsql.parser.ast.NoArgRSQLVisitorAdapter;
import cz.jirutka.rsql.parser.ast.OrNode;
import java.util.List;
import java.util.Map;
import java.util.Set;
import io.github.perplexhub.rsql.QuerySupport;
import io.github.perplexhub.rsql.RSQLJPASupport;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

/**
 * Converts a public RSQL query into a JPA specification after restricting its selectors to the
 * aliases explicitly documented by an endpoint. The RSQL starter remains responsible for parsing
 * values and producing predicates; this class only prevents the public contract from becoming a
 * traversal API for JPA entities.
 */
public final class RsqlFilter {

  private static final int MAX_QUERY_LENGTH = 1_000;

  private RsqlFilter() { }

  public static <T> Specification<T> specification(String query, Map<String, String> aliases,
      Map<Class<?>, List<String>> propertyWhitelist) {
    if (!StringUtils.hasText(query)) return Specification.unrestricted();
    if (query.length() > MAX_QUERY_LENGTH) throw new IllegalArgumentException("filtro muito longo");
    validateSelectors(query, aliases.keySet());
    return RSQLJPASupport.toSpecification(QuerySupport.builder()
        .rsqlQuery(query)
        .distinct(true)
        .propertyPathMapper(aliases)
        .propertyWhitelist(propertyWhitelist)
        .strictEquality(true)
        .build());
  }

  private static void validateSelectors(String query, Set<String> selectors) {
    try {
      new RSQLParser().parse(query).accept(new SelectorWhitelist(selectors));
    } catch (IllegalArgumentException exception) {
      throw exception;
    } catch (RuntimeException exception) {
      throw new IllegalArgumentException("filtro RSQL inválido", exception);
    }
  }

  private static final class SelectorWhitelist extends NoArgRSQLVisitorAdapter<Void> {
    private final Set<String> selectors;

    private SelectorWhitelist(Set<String> selectors) { this.selectors = selectors; }

    @Override public Void visit(AndNode node) {
      node.getChildren().forEach(child -> child.accept(this));
      return null;
    }

    @Override public Void visit(OrNode node) {
      node.getChildren().forEach(child -> child.accept(this));
      return null;
    }

    @Override public Void visit(ComparisonNode node) {
      if (!selectors.contains(node.getSelector())) {
        throw new IllegalArgumentException("seletor de filtro não permitido");
      }
      return null;
    }
  }
}
